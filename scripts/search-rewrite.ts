// Sends the queries models wrote in a workflow search run to the API's BM25 tool search again, one at a time, with the
// catalog as served and with each description starting with the tool's name split into words:
// `emailSending_subdomains_list` gets "email sending subdomains list. " before its description. Every tool gets the same
// rule. The search does not split tool names, so this puts the name's words where the search can match them.
// Haiku passes each query word for word, with the `limit` asked. The search returns 5 tools unless the model passes
// `limit`, and in the workflow runs the models passed other limits on some searches. Those inputs were not recorded. A
// smaller limit returns a prefix of a larger one's results, so the number a search returned is inferred as the longest
// prefix of the served catalog's results at the largest limit sent that its trial loaded.
// Scored per required step of each trial, as in workflow-run.ts: a step counts when a fitting tool is among the tools
// returned for that trial's queries. The model is not run on the tasks, so a trial keeps the queries it wrote against the
// served catalog.
// Usage: tsx scripts/search-rewrite.ts <workflow search jsonl> [--model m] [--catalogs served,name-words] [--limits 5,10] [--parallel N] [--out file] [--env <.env path>]
//        tsx scripts/search-rewrite.ts <workflow search jsonl> --score <rows jsonl> [<rows jsonl> ...]
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
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
const runFile = args[0]!
const FLAT = 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp'
const system = (limit: number) => `Call the tool search tool once, with the query the user gives, word for word, and limit ${limit}. Do not change the query. Then reply with the word done. Call no other tool.`

type Trial = { id: string; sample: number; finds: string[]; loaded: string[] }
type Step = { does: string; tools: string[]; stated: boolean; optional?: true }
type Row = { catalog: string; limit: number; query: string; sent: string[]; limits: (number | null)[]; returned: string[][]; inputTokens: number; error?: string }
const trials = readFileSync(runFile, 'utf8').split('\n').filter(Boolean).slice(1).map((line) => JSON.parse(line) as Trial)
const tasks = new Map((JSON.parse(readFileSync('scripts/workflow-tasks.json', 'utf8')) as { id: string; steps: Step[] }[]).map((task) => [task.id, task.steps]))
const queries = [...new Set(trials.flatMap((trial) => trial.finds))]

const nameWords = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase()

function score(rows: Row[]) {
  const key = (catalog: string, limit: number, query: string) => `${catalog}\n${limit}\n${query}`
  const returned = new Map(rows.filter((row) => !row.error).map((row) => [key(row.catalog, row.limit ?? 5, row.query), row.returned.flat()]))
  const get = (catalog: string, limit: number, query: string) => returned.get(key(catalog, limit, query))
  const catalogs = [...new Set(rows.map((row) => row.catalog))]
  const limits = [...new Set(rows.map((row) => row.limit ?? 5))].sort((a, b) => a - b)
  // A catalog's results for a query at the largest limit sent. A smaller limit returns a prefix of them.
  const deepest = (catalog: string, query: string) => [...limits].reverse().map((limit) => get(catalog, limit, query)).find(Boolean) ?? []
  const deepLimit = Math.max(...rows.filter((row) => row.catalog === 'served').map((row) => row.limit ?? 5))
  // The number of tools each search in the run returned, inferred as the longest prefix of the served catalog's deepest
  // results that the trial loaded. Another search of the trial loading the next tools would make it too large.
  const asRun = (trial: Trial, query: string) => {
    const list = deepest('served', query)
    let count = 0
    while (count < list.length && trial.loaded.includes(list[count]!)) count++
    return count
  }
  const present = [...new Set(rows.map((row) => `${row.catalog} at ${row.limit ?? 5}`))]
  const labels = [...catalogs.flatMap((catalog) => limits.map((limit) => `${catalog} at ${limit}`).filter((label) => present.includes(label))), ...(deepLimit > 5 ? catalogs.map((catalog) => `${catalog} at the run's limits`) : [])]
  const lookup = (label: string, trial: Trial) => {
    const [catalog, rest] = label.split(' at ') as [string, string]
    return trial.finds.flatMap((query) => (rest === "the run's limits" ? deepest(catalog, query).slice(0, asRun(trial, query)) : (get(catalog, Number(rest), query) ?? [])))
  }
  const fits = (tools: string[], names: Iterable<string>) => [...names].some((name) => tools.some((prefix) => name.startsWith(prefix)))
  const totals = new Map<string, number>()
  const missed = new Map<string, string[]>()
  let steps = 0
  for (const trial of trials) {
    const found = new Map(labels.map((label) => [label, lookup(label, trial)]))
    for (const step of tasks.get(trial.id) ?? []) {
      if (step.optional) continue
      steps++
      for (const [label, names] of [['the run, as recorded', trial.loaded] as const, ...found]) {
        if (fits(step.tools, names)) totals.set(label, (totals.get(label) ?? 0) + 1)
        else missed.set(label, [...(missed.get(label) ?? []), `${trial.id} #${trial.sample}: ${step.does}`])
      }
    }
  }
  console.log(`${trials.length} trials, ${queries.length} distinct queries, ${steps} required steps.\n`)
  if (deepLimit > 5) {
    const searches = trials.flatMap((trial) => trial.finds.map((query) => asRun(trial, query)))
    const counts = new Map<number, number>()
    for (const count of searches) counts.set(count, (counts.get(count) ?? 0) + 1)
    const same = trials.filter((trial) => {
      const rebuilt = new Set(lookup("served at the run's limits", trial))
      const loaded = new Set(trial.loaded)
      return rebuilt.size === loaded.size && [...loaded].every((name) => rebuilt.has(name))
    }).length
    const fullTen = trials.flatMap((trial) => trial.finds.filter((query) => { const ten = get('served', 10, query); return ten?.length === 10 && ten.every((name) => trial.loaded.includes(name)) })).length
    console.log(`Searches whose ten served results at limit 10 the trial loaded in full: ${fullTen} of ${searches.length}.`)
    console.log(`Tools returned per search in the run, inferred: ${[...counts].sort((x, y) => x[0] - y[0]).map(([count, n]) => `${count} in ${n}`).join(', ')}, of ${searches.length} searches. Trials whose loaded tools the served catalog at the run's limits gives exactly: ${same} of ${trials.length}.\n`)
  }
  console.log('| Tools returned by | Required steps with a fitting tool returned |')
  console.log('| :-- | --: |')
  for (const label of ['the run, as recorded', ...labels]) console.log(`| ${label} | ${totals.get(label) ?? 0} of ${steps} |`)
  for (const label of ['the run, as recorded', ...labels]) console.log(`\nNo fitting tool returned, ${label}:\n${(missed.get(label) ?? []).map((line) => `- ${line}`).join('\n')}`)
  const errors = rows.filter((row) => row.error).length
  const altered = rows.filter((row) => !row.error && !(row.sent.length === 1 && row.sent[0] === row.query && (row.limits?.[0] ?? null) === (row.limit === undefined ? null : row.limit))).length
  console.log(`\n${rows.length} rows, ${errors} errors, ${altered} not passed word for word with the limit asked, ${rows.reduce((sum, row) => sum + row.inputTokens, 0)} input tokens.`)
}

const scoreAt = args.indexOf('--score')
if (scoreAt >= 0) {
  const files = args.slice(scoreAt + 1).filter((file) => !file.startsWith('--'))
  score(files.flatMap((file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(1).map((line) => JSON.parse(line) as Row)))
} else {
  const model = opt('model', 'claude-haiku-5-5')!
  const catalogs = opt('catalogs', 'served,name-words')!.split(',')
  const limits = opt('limits', '5,10')!.split(',').map(Number)
  const parallel = Number(opt('parallel', '4'))
  const out = opt('out', `results/${new Date().toISOString().slice(0, 10)}-search-rewrite.jsonl`)!
  type Listed = { name: string; description?: string; inputSchema?: unknown }
  const flat = new Client({ name: 'groups-search-rewrite', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
  await flat.connect(new StreamableHTTPClientTransport(new URL(FLAT)))
  const listed: Listed[] = []
  let cursor: string | undefined
  do {
    const page = await flat.listTools(cursor ? { cursor } : undefined)
    listed.push(...page.tools)
    cursor = page.nextCursor
  } while (cursor)
  await flat.close()
  const describe = (catalog: string, tool: Listed) => (catalog === 'name-words' ? `${nameWords(tool.name)}. ${tool.description ?? ''}` : (tool.description ?? ''))
  const anthropic = new Anthropic({ maxRetries: 4 })
  writeFileSync(out, JSON.stringify({ flat: FLAT, run: runFile, tools: listed.length, model, catalogs, limits, queries: queries.length, system: limits.map(system) }) + '\n')
  const rows: Row[] = []
  for (const catalog of catalogs) {
    const tools: Anthropic.ToolUnion[] = [
      { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' },
      ...listed.map((tool) => ({ name: tool.name, description: describe(catalog, tool), input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true })),
    ]
    const jobs = limits.flatMap((limit) => queries.map((query) => ({ limit, query })))
    const send = async ({ limit, query }: { limit: number; query: string }) => {
      const row: Row = { catalog, limit, query, sent: [], limits: [], returned: [], inputTokens: 0 }
      try {
        const response = await anthropic.messages.create({ model, max_tokens: 400, output_config: { effort: 'low' }, system: system(limit), tools, messages: [{ role: 'user', content: query }] } as Anthropic.MessageCreateParamsNonStreaming)
        row.inputTokens = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)
        for (const block of response.content as Array<Record<string, any>>) {
          if (block.type === 'server_tool_use') {
            row.sent.push(String(block.input?.query ?? JSON.stringify(block.input)))
            row.limits.push(typeof block.input?.limit === 'number' ? block.input.limit : null)
          } else if (block.type === 'tool_search_tool_result') row.returned.push((block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
        }
      } catch (error) {
        row.error = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
      }
      rows.push(row)
      appendFileSync(out, JSON.stringify(row) + '\n')
      process.stderr.write('.')
    }
    await Promise.all(Array.from({ length: parallel }, async () => {
      for (let job = jobs.shift(); job; job = jobs.shift()) await send(job)
    }))
  }
  process.stderr.write('\n')
  console.log(`Rows in ${out}\n`)
  score(rows)
}
