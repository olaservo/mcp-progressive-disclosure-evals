// Probes how the Messages API's BM25 tool search tokenizes, indexes and breaks ties. Each case sends one tool list
// with `defer_loading` and one query, which Haiku passes to the search word for word, and records the tools returned.
// Cases on the full catalog: the same queries with the catalog in served, reversed and shuffled order, and single
// terms. Cases on small made-up catalogs: where a word must sit to be found, identical tools in different orders,
// and term count against document length.
// Usage: tsx scripts/search-mechanics.ts [--model m] [--out file] [--only prefix] [--env <.env path>]
//        tsx scripts/search-mechanics.ts --dump <file>   writes the served catalog for scripts/search-fit.py and stops
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
const model = opt('model', 'claude-haiku-5-5')!
const out = opt('out', `results/${new Date().toISOString().slice(0, 10)}-search-mechanics.jsonl`)!
const only = opt('only')
const FLAT = 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp'
const SYSTEM = 'Call the tool search tool once, with the query the user gives, word for word. Do not change the query. Then reply with the word done. Call no other tool.'

type Tool = { name: string; description: string; input_schema: Record<string, unknown> }
const flat = new Client({ name: 'groups-search-mechanics', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await flat.connect(new StreamableHTTPClientTransport(new URL(FLAT)))
const served: Tool[] = []
let cursor: string | undefined
do {
  const page = await flat.listTools(cursor ? { cursor } : undefined)
  served.push(...page.tools.map((tool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema as Record<string, unknown> })))
  cursor = page.nextCursor
} while (cursor)
await flat.close()
const dump = opt('dump')
if (dump) {
  writeFileSync(dump, JSON.stringify(served.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.input_schema }))))
  console.log(`${served.length} tools written to ${dump}`)
  process.exit(0)
}

// A fixed shuffle, so the run can be repeated.
function shuffled<T>(items: T[], seed: number): T[] {
  const copy = [...items]
  let state = seed
  const next = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
  for (let at = copy.length - 1; at > 0; at--) {
    const other = Math.floor(next() * (at + 1))
    ;[copy[at], copy[other]] = [copy[other]!, copy[at]!]
  }
  return copy
}

const schema = (properties: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ type: 'object', properties, ...extra })
const FILLER_WORDS = 'river stone copper lantern meadow harbor violet canyon ember orchard quartz falcon'.split(' ')
const filler = (count: number): Tool[] =>
  Array.from({ length: count }, (_, at) => ({
    name: `filler_${String.fromCharCode(97 + at)}_get`,
    description: `Returns the ${FILLER_WORDS[at % 12]} record for a ${FILLER_WORDS[(at + 5) % 12]} account.`,
    input_schema: schema({ id: { type: 'string', description: `The ${FILLER_WORDS[(at + 3) % 12]} identifier.` } }),
  }))

// Where a word has to be for the search to find the tool. Each made-up word appears in one place only.
const placement: Tool[] = [
  { name: 'place_description', description: 'Returns the plimbat report.', input_schema: schema({ id: { type: 'string', description: 'Report identifier.' } }) },
  { name: 'place_argname', description: 'Returns a report.', input_schema: schema({ quorvex: { type: 'string', description: 'Report identifier.' } }) },
  { name: 'place_argdescription', description: 'Returns a report.', input_schema: schema({ id: { type: 'string', description: 'The snellig identifier.' } }) },
  { name: 'place_nested', description: 'Returns a report.', input_schema: schema({ body: { type: 'object', properties: { id: { type: 'string', description: 'The trawzen identifier.' } } } }) },
  { name: 'place_enum', description: 'Returns a report.', input_schema: schema({ kind: { type: 'string', description: 'Report kind.', enum: ['daily', 'vombrel'] } }) },
  { name: 'place_defs', description: 'Returns a report.', input_schema: schema({ body: { $ref: '#/$defs/payload' } }, { $defs: { payload: { type: 'object', properties: { id: { type: 'string', description: 'The gluthar identifier.' } } } } }) },
  { name: 'place_title', description: 'Returns a report.', input_schema: schema({ id: { type: 'string', title: 'Krandle', description: 'Report identifier.' } }) },
  { name: 'place_default', description: 'Returns a report.', input_schema: schema({ mode: { type: 'string', description: 'Report mode.', default: 'zestrop' } }) },
  { name: 'place_namepart_frobule', description: 'Returns a report.', input_schema: schema({ id: { type: 'string', description: 'Report identifier.' } }) },
  { name: 'place_camelCaseWimbrel', description: 'Returns a report.', input_schema: schema({ id: { type: 'string', description: 'Report identifier.' } }) },
  { name: 'place_hyphen', description: 'Returns the dorvin-kelp report.', input_schema: schema({ id: { type: 'string', description: 'Report identifier.' } }) },
  { name: 'place_underscore_text', description: 'Returns the yarrow_plinth report.', input_schema: schema({ id: { type: 'string', description: 'Report identifier.' } }) },
  ...filler(8),
]

// Eight tools with the same description and schema, and names that tokenize alike.
const twin = (name: string): Tool => ({ name, description: 'Lists the widget inventory.', input_schema: schema({ id: { type: 'string', description: 'Warehouse identifier.' } }) })
const TWIN_NAMES = ['aa_widget_list', 'bb_widget_list', 'cc_widget_list', 'dd_widget_list', 'ww_widget_list', 'xx_widget_list', 'yy_widget_list', 'zz_widget_list']
const twins = TWIN_NAMES.map(twin)

// Term count against length: "gadget" a given number of times, padded with words found nowhere else.
const PAD = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango'.split(' ')
const padded = (name: string, gadgets: number, pad: number): Tool => ({
  name,
  description: [...Array(gadgets).fill('gadget'), ...Array.from({ length: pad }, (_, at) => PAD[at % 20])].join(' '),
  input_schema: schema(),
})
const lengths: Tool[] = [
  padded('len_1x_pad0', 1, 0),
  padded('len_1x_pad40', 1, 40),
  padded('len_2x_pad40', 2, 40),
  padded('len_4x_pad40', 4, 40),
  padded('len_8x_pad40', 8, 40),
  padded('len_4x_pad200', 4, 200),
  padded('len_8x_pad200', 8, 200),
  padded('len_16x_pad200', 16, 200),
  ...filler(8),
]

type Case = { id: string; catalog: string; tools: Tool[]; query: string }
const CATALOGS: Record<string, Tool[]> = {
  served,
  reversed: [...served].reverse(),
  shuffled: shuffled(served, 20261126),
  placement,
  'twins-alpha': [...twins, ...filler(8)],
  'twins-reversed': [...twins].reverse().concat(filler(8)),
  'twins-shuffled': shuffled(twins, 7).concat(filler(8)),
  lengths,
  'lengths-reversed': [...lengths].reverse(),
}
const cases: Case[] = []
const add = (id: string, catalog: string, query: string) => cases.push({ id, catalog, tools: CATALOGS[catalog]!, query })
// Order of the full catalog.
for (const catalog of ['served', 'reversed', 'shuffled']) {
  add(`order-zones-${catalog}`, catalog, 'zones list account get zone id name')
  add(`order-listzones-${catalog}`, catalog, 'list zones')
  add(`order-email-${catalog}`, catalog, 'list email sending subdomains')
}
add('repeat-zones-served-2', 'served', 'zones list account get zone id name')
// Single terms and stemming on the full catalog.
for (const query of ['name', 'id', 'identifier', 'lookup', 'zones list account get', 'zone', 'zones', 'subdomain', 'subdomains', 'listing zones', 'zones_list', 'zones list']) add(`term-${query}`, 'served', query)
// Placement.
for (const word of ['plimbat', 'quorvex', 'snellig', 'trawzen', 'vombrel', 'gluthar', 'krandle', 'zestrop', 'frobule', 'wimbrel', 'dorvin', 'kelp', 'yarrow', 'plinth', 'place_namepart_frobule', 'Plimbat', 'plimbats']) add(`place-${word}`, 'placement', word)
// Ties.
for (const catalog of ['twins-alpha', 'twins-reversed', 'twins-shuffled']) add(`ties-${catalog}`, catalog, 'widget inventory')
// Term count and length.
for (const catalog of ['lengths', 'lengths-reversed']) add(`len-${catalog}`, catalog, 'gadget')

const anthropic = new Anthropic({ maxRetries: 4 })
const selected = cases.filter((entry) => !only || entry.id.startsWith(only))
writeFileSync(out, JSON.stringify({ model, flat: FLAT, cases: selected.length, system: SYSTEM, twinOrders: { alpha: TWIN_NAMES, shuffled: CATALOGS['twins-shuffled']!.slice(0, 8).map((tool) => tool.name) } }) + '\n')
let tokens = 0
for (const entry of selected) {
  const row: Record<string, unknown> = { id: entry.id, catalog: entry.catalog, query: entry.query, tools: entry.tools.length }
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 400,
      output_config: { effort: 'low' },
      system: SYSTEM,
      tools: [{ type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' }, ...entry.tools.map((tool) => ({ ...tool, defer_loading: true }))],
      messages: [{ role: 'user', content: entry.query }],
    } as Anthropic.MessageCreateParamsNonStreaming)
    const sent: string[] = []
    const returned: string[][] = []
    for (const block of response.content as Array<Record<string, any>>) {
      if (block.type === 'server_tool_use') sent.push(String(block.input?.query ?? JSON.stringify(block.input)))
      else if (block.type === 'tool_search_tool_result') returned.push((block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
    }
    const used = response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)
    tokens += used
    Object.assign(row, { sent, returned, inputTokens: used })
  } catch (error) {
    row.error = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
  }
  appendFileSync(out, JSON.stringify(row) + '\n')
  const index = new Map(entry.tools.map((tool, at) => [tool.name, at]))
  const got = ((row.returned as string[][] | undefined)?.[0] ?? []).map((name) => `${name}#${index.get(name)}`)
  const asGiven = (row.sent as string[] | undefined)?.length === 1 && (row.sent as string[])[0] === entry.query
  console.log(`${entry.id} | "${entry.query}" | ${row.error ?? (asGiven ? '' : `SENT ${JSON.stringify(row.sent)} | `) + got.join(', ')}`)
}
console.log(`\n${selected.length} requests, ${tokens} input tokens. Rows in ${out}`)
