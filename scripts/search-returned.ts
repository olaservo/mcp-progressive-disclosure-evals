// What kinds of tools did the API's tool search return in recorded runs, against what the catalog holds? No model.
// A tool's kind is the verb at the end of its name. Reads rows of search-run.ts or of workflow-run.ts --arm search.
// Usage: tsx scripts/search-returned.ts <jsonl> [<jsonl> ...]
import { readFileSync } from 'node:fs'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const FLAT = 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp'
type Listed = { name: string; description?: string; inputSchema?: unknown }
const flat = new Client({ name: 'groups-search-returned', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await flat.connect(new StreamableHTTPClientTransport(new URL(FLAT)))
const tools: Listed[] = []
let cursor: string | undefined
do {
  const page = await flat.listTools(cursor ? { cursor } : undefined)
  tools.push(...page.tools)
  cursor = page.nextCursor
} while (cursor)
await flat.close()

const size = new Map(tools.map((tool) => [tool.name, JSON.stringify(tool.inputSchema ?? {}).length + (tool.description ?? '').length]))
const VERBS = ['list', 'get', 'create', 'update', 'edit', 'delete', 'other']
const WRITES = ['create', 'update', 'edit', 'delete']
const verb = (name: string) => {
  const last = name.split('_').pop()!.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')[0]!.toLowerCase()
  return VERBS.includes(last) ? last : 'other'
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1]
const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(0)}%`

type Trial = { queries: string[]; got: string[] }
const trials: Trial[] = []
for (const file of process.argv.slice(2)) {
  for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(1)) {
    const row = JSON.parse(line) as { finds?: string[]; queries?: string[]; loaded?: string[]; returned?: string[] }
    const queries = row.finds ?? row.queries
    const got = row.loaded ?? row.returned
    if (queries?.length && got?.length) trials.push({ queries, got })
  }
}
const queries = trials.flatMap((trial) => trial.queries)
const returned = trials.flatMap((trial) => trial.got)
console.log(`${tools.length} tools. ${trials.length} trials, ${queries.length} queries, ${returned.length} tools returned, repeats counted.\n`)
console.log('| Kind | Share of catalog | Share of tools returned | Median characters of description and schema |')
console.log('| :-- | --: | --: | --: |')
for (const kind of VERBS) {
  const inCatalog = tools.filter((tool) => verb(tool.name) === kind)
  const got = returned.filter((name) => verb(name) === kind)
  console.log(`| ${kind} | ${percent(inCatalog.length, tools.length)} (${inCatalog.length}) | ${percent(got.length, returned.length)} (${got.length}) | ${median(inCatalog.map((tool) => size.get(tool.name)!))} |`)
}
console.log(`\nMedian characters: catalog ${median(tools.map((tool) => size.get(tool.name)!))}, tools returned ${median(returned.map((name) => size.get(name) ?? 0))}.`)

const says = (query: string, word: string) => query.toLowerCase().split(/[^a-z]+/).includes(word)
console.log(`Queries holding the word: ${['list', 'get', 'create', 'update', 'delete'].map((word) => `"${word}" ${queries.filter((query) => says(query, word)).length}`).join(', ')}.`)
const only = trials.filter((trial) => trial.queries.every((query) => says(query, 'list') && !['create', 'update', 'delete'].some((word) => says(query, word))))
const got = only.flatMap((trial) => trial.got)
console.log(`Trials whose every query says "list" and not create, update or delete: ${only.length}. Tools returned ${got.length}: ${got.filter((name) => verb(name) === 'list').length} list, ${got.filter((name) => verb(name) === 'get').length} get, ${got.filter((name) => WRITES.includes(verb(name))).length} create, update, edit or delete.`)

// A sibling is the tool with the same name up to the last part.
const siblings = (have: (kind: string) => boolean, want: string) => {
  let pairs = 0
  let absent = 0
  for (const trial of trials) {
    const set = new Set(trial.got)
    for (const parent of new Set(trial.got.filter((name) => have(verb(name))).map((name) => name.split('_').slice(0, -1).join('_')))) {
      if (!size.has(`${parent}_${want}`)) continue
      pairs++
      if (!set.has(`${parent}_${want}`)) absent++
    }
  }
  return `${absent} of ${pairs}`
}
console.log(`A create, update, edit or delete tool was returned and a sibling _list tool exists: the _list tool was returned nowhere in the trial in ${siblings((kind) => WRITES.includes(kind), 'list')} cases.`)
console.log(`The reverse, a _list tool returned and a sibling _create exists: the _create tool was returned nowhere in the trial in ${siblings((kind) => kind === 'list', 'create')} cases.`)
