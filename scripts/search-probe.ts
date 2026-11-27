// Passes fixed queries to the API's BM25 tool search one at a time, with the whole catalog sent with `defer_loading`,
// and records the tools each query returns. search-run.ts and workflow-run.ts record returned tools per trial, not per
// query. The queries are ones models wrote in the workflow runs when looking for a list or lookup tool.
// Usage: tsx scripts/search-probe.ts [--model m] [--samples N] [--env <.env path>]
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : fallback
}
const envFile = opt('env')
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}
const FLAT = 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp'
const model = opt('model', 'claude-haiku-5-5')!
const samples = Number(opt('samples', '1'))

// [query, tools that would have done the lookup]
const CASES: [string, string[]][] = [
  ['list zones by domain name', ['zones_list', 'zones_get']],
  ['zones list account get zone id name', ['zones_list', 'zones_get']],
  ['zone lookup get zone identifier account zones list', ['zones_list', 'zones_get']],
  ['list zones by name acmeshop.io', ['zones_list', 'zones_get']],
  ['list zones filter by name', ['zones_list', 'zones_get']],
  ['list accounts memberships Acme Staging account id', ['accounts_list', 'organization_account_list']],
  ['list accounts under account name lookup', ['accounts_list', 'organization_account_list']],
  ['list all accounts Cloudflare', ['accounts_list', 'organization_account_list']],
  ['list notification policies alerting', ['alerting_policies_list']],
  ['alerting policies get all policies account', ['alerting_policies_list']],
  ['get alerting policies by name Production Error Spike', ['alerting_policies_list']],
  ['Durable Objects namespaces list objects count', ['durableObjects_namespaces_list']],
  ['durable objects namespaces list objects count script', ['durableObjects_namespaces_list']],
  ['list email sending subdomains', ['emailSending_subdomains_list']],
  ['email sending subdomains list zone', ['emailSending_subdomains_list']],
  ['get email sending subdomains list for zone', ['emailSending_subdomains_list']],
  // The tool's own name, as a query.
  ['zones_list', ['zones_list']],
  ['accounts_list', ['accounts_list']],
  ['alerting_policies_list', ['alerting_policies_list']],
  ['list zones', ['zones_list']],
]
const SYSTEM = 'Call the tool search tool once, with the query the user gives, word for word. Do not change the query. Then reply with the word done. Call no other tool.'

type Listed = { name: string; description?: string; inputSchema?: unknown }
const flat = new Client({ name: 'groups-search-probe', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await flat.connect(new StreamableHTTPClientTransport(new URL(FLAT)))
const listed: Listed[] = []
let cursor: string | undefined
do {
  const page = await flat.listTools(cursor ? { cursor } : undefined)
  listed.push(...page.tools)
  cursor = page.nextCursor
} while (cursor)
await flat.close()
const tools: Anthropic.ToolUnion[] = [
  { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' },
  ...listed.map((tool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true })),
]
const anthropic = new Anthropic({ maxRetries: 4 })

mkdirSync('results/search', { recursive: true })
const out = `results/search/${new Date().toISOString().slice(0, 10)}-search-probe.jsonl`
writeFileSync(out, JSON.stringify({ flat: FLAT, tools: listed.length, model, samples, system: SYSTEM }) + '\n')
type Row = { query: string; want: string[]; sample: number; sent: string[]; returned: string[][]; inputTokens: number; error?: string }
const rows: Row[] = []
for (const [query, want] of CASES) {
  for (let sample = 1; sample <= samples; sample++) {
    const row: Row = { query, want, sample, sent: [], returned: [], inputTokens: 0 }
    try {
      const response = await anthropic.messages.create({ model, max_tokens: 400, output_config: { effort: 'low' }, system: SYSTEM, tools, messages: [{ role: 'user', content: query }] } as Anthropic.MessageCreateParamsNonStreaming)
      row.inputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)
      for (const block of response.content as Array<Record<string, any>>) {
        if (block.type === 'server_tool_use') row.sent.push(String(block.input?.query ?? JSON.stringify(block.input)))
        else if (block.type === 'tool_search_tool_result') row.returned.push((block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
      }
    } catch (error) {
      row.error = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
    }
    rows.push(row)
    appendFileSync(out, JSON.stringify(row) + '\n')
    process.stderr.write('.')
  }
}
process.stderr.write('\n')

console.log(`${listed.length} tools, ${model}, ${rows.length} requests, ${rows.reduce((sum, row) => sum + row.inputTokens, 0)} input tokens. Rows in ${out}\n`)
console.log('| Query | Wanted | Query sent as given | Returned | Wanted tool at | Tools returned |')
console.log('| :-- | :-- | :-- | --: | :-- | :-- |')
let hit = 0
let asGiven = 0
for (const row of rows) {
  const got = row.returned[0] ?? []
  const at = got.findIndex((name) => row.want.some((prefix) => name.startsWith(prefix)))
  const same = row.sent.length === 1 && row.sent[0] === row.query
  if (same) asGiven++
  if (at >= 0) hit++
  console.log(`| ${row.query} | ${row.want[0]} | ${same ? 'yes' : row.error ? `error: ${row.error.slice(0, 60)}` : `no: ${row.sent.join(' ; ')}`} | ${got.length} | ${at >= 0 ? at + 1 : 'not returned'} | ${got.join(', ')} |`)
}
console.log(`\nWanted tool returned for ${hit} of ${rows.length} queries. Query passed word for word in ${asGiven}.`)
