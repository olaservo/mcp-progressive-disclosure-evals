// Replays the queries from a search-run.ts file against a local BM25 over the catalog, as served and with product names replaced.
// No model is called. The queries were written for the catalog as served, so the renamed rows show how much those queries
// leaned on product names. A model facing a renamed catalog would write other queries.
// A tool's text is its name, description, argument names and argument descriptions, the fields the Messages API's search indexes.
// Renamings:
//   prefix: the tool name's product prefix becomes an invented word, `spectrum_apps_create` to `<word>_apps_create`.
//   label:  the same, and in the description and argument text the product's label becomes that word, the API path line and
//           URLs are dropped and "Cloudflare" is removed. Every prefix counts as a product name, so `ips` renames "IP" and
//           `accounts` renames "account".
//   brand:  the vendor and the coined product names in scripts/rename.ts become invented words, in names, descriptions and
//           argument descriptions. Names that describe the product are kept.
// Usage: tsx scripts/search-replay.ts <search-run jsonl> [--url <flat mcp url>] [--show <tool name>]
import { readFileSync } from 'node:fs'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { renameTool } from './rename.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : fallback
}
const file = args[0]
if (!file || file.startsWith('--')) throw new Error('Usage: tsx scripts/search-replay.ts <search-run jsonl> [--url <flat mcp url>] [--show <tool name>]')
const url = opt('url', 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp')!
const show = opt('show')

type Task = { id: string; product: string; task: string; tools: string[] }
type Trial = { model: string; id: string; queries: string[]; returned: string[]; error?: string }
type Listed = { name: string; description?: string; inputSchema?: unknown }
const tasks = JSON.parse(readFileSync(new URL('../tasks/select-v3.json', import.meta.url), 'utf8')) as Task[]
const byId = new Map(tasks.map((task) => [task.id, task]))
const does = (task: Task, name: string) => task.tools.some((prefix) => name.startsWith(prefix))
const trials = readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(1).map((line) => JSON.parse(line) as Trial).filter((trial) => !trial.error)

const mcp = new Client({ name: 'groups-search-replay', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await mcp.connect(new StreamableHTTPClientTransport(new URL(url)))
const tools: Listed[] = []
let cursor: string | undefined
do {
  const page = await mcp.listTools(cursor ? { cursor } : undefined)
  tools.push(...page.tools)
  cursor = page.nextCursor
} while (cursor)
await mcp.close()

// As in search-overlap.ts, without the stop list: a query is a few keywords.
const words = (text: string) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1)
    .map((word) => word.replace(/(ies)$/, 'y').replace(/(?<=[a-z]{3})s$/, ''))

function argumentText(schema: unknown): string {
  const out: string[] = []
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries<any>(node.properties ?? {})) {
      out.push(key)
      if (typeof value?.description === 'string') out.push(value.description)
      walk(value)
    }
    walk(node.items)
    for (const key of ['anyOf', 'oneOf', 'allOf']) for (const part of node[key] ?? []) walk(part)
  }
  walk(schema)
  return out.join(' ')
}

const prefixOf = (name: string) => name.split('_')[0]!
const prefixes = [...new Set(tools.map((tool) => prefixOf(tool.name)))]
const SYLLABLES = 'zor vek mul tan bri fex dol qua nim sar pel gru hax lio wem cay rud osk tiv yab'.split(' ')
const invented = new Map(prefixes.map((prefix, at) => [prefix, SYLLABLES[at % 20]! + SYLLABLES[(at * 7 + 3) % 20]! + SYLLABLES[Math.floor(at / 20)]!]))
// `emailSending` matches "Email Sending", "email-sending" and "emailsending", and `queues` matches "queue" and "queues".
function label(prefix: string): RegExp {
  const parts = prefix.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ')
  parts.push(parts.pop()!.replace(/s$/, '') + '(?:e?s)?')
  return new RegExp(`\\b${parts.join('[ _/-]?')}\\b`, 'gi')
}

const RENAMINGS = ['as served', 'prefix', 'label', 'brand'] as const
type Renaming = (typeof RENAMINGS)[number]
function text(tool: Listed, renaming: Renaming): string {
  if (renaming === 'brand') {
    const renamed = renameTool(tool)
    return `${renamed.name}\n${renamed.description ?? ''}\n${argumentText(renamed.inputSchema)}`
  }
  const prefix = prefixOf(tool.name)
  const word = invented.get(prefix)!
  const name = renaming === 'as served' ? tool.name : word + tool.name.slice(prefix.length)
  let rest = `${tool.description ?? ''}\n${argumentText(tool.inputSchema)}`
  if (renaming === 'label') {
    rest = rest
      .replace(/^(GET|POST|PUT|PATCH|DELETE) \/\S*\s*$/m, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/Cloudflare/g, '')
      .replace(label(prefix), word)
  }
  return `${name}\n${rest}`
}

function searcher(renaming: Renaming): (query: string, top: number) => string[] {
  const docs = tools.map((tool) => words(text(tool, renaming)))
  const df = new Map<string, number>()
  for (const doc of docs) for (const word of new Set(doc)) df.set(word, (df.get(word) ?? 0) + 1)
  const avg = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length
  const tfs = docs.map((doc) => {
    const tf = new Map<string, number>()
    for (const word of doc) tf.set(word, (tf.get(word) ?? 0) + 1)
    return tf
  })
  const K1 = 1.2
  const B = 0.75
  return (query, top) =>
    docs
      .map((doc, at) => {
        let score = 0
        for (const word of new Set(words(query))) {
          const f = tfs[at]!.get(word)
          if (!f) continue
          const idf = Math.log(1 + (docs.length - df.get(word)! + 0.5) / (df.get(word)! + 0.5))
          score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / avg))
        }
        return { score, name: tools[at]!.name }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, top)
      .map((entry) => entry.name)
}

if (show) {
  const tool = tools.find((candidate) => candidate.name === show)
  if (!tool) throw new Error(`No tool named ${show}`)
  for (const renaming of RENAMINGS) console.log(`--- ${renaming}\n${text(tool, renaming).slice(0, 1200)}\n`)
} else {
  const queries = trials.reduce((sum, trial) => sum + trial.queries.length, 0)
  const named = trials.reduce((sum, trial) => sum + trial.queries.filter((query) => byId.get(trial.id)!.tools.some((entry) => label(prefixOf(entry)).test(query))).length, 0)
  const api = trials.filter((trial) => trial.returned.some((name) => does(byId.get(trial.id)!, name))).length
  console.log(`${tools.length} tools from ${url}, ${trials.length} trials and ${queries} queries from ${file}`)
  console.log(`${named} of the queries hold the product label of a tool that does the task. The API's search returned such a tool in ${api} trials.`)

  // hits[renaming][top][task id] counts the trials whose queries bring back a tool that does the task.
  const TOPS = [5, 10]
  const hits = new Map<string, Map<string, number>>()
  console.log('\n| Catalog | In the top 5 | In the top 10 | Same verdict as the API, top 10 | API-returned tools also in the top 10 |')
  console.log('| :-- | --: | --: | --: | --: |')
  for (const renaming of RENAMINGS) {
    const search = searcher(renaming)
    const totals: number[] = []
    let same = 0
    let shared = 0
    let returned = 0
    for (const top of TOPS) {
      const perTask = new Map<string, number>()
      hits.set(`${renaming} ${top}`, perTask)
      for (const trial of trials) {
        const task = byId.get(trial.id)!
        const local = new Set(trial.queries.flatMap((query) => search(query, top)))
        const hit = [...local].some((name) => does(task, name))
        if (hit) perTask.set(trial.id, (perTask.get(trial.id) ?? 0) + 1)
        if (top !== 10) continue
        if (hit === trial.returned.some((name) => does(task, name))) same++
        const fromApi = new Set(trial.returned)
        shared += [...fromApi].filter((name) => local.has(name)).length
        returned += fromApi.size
      }
      totals.push([...perTask.values()].reduce((sum, count) => sum + count, 0))
    }
    console.log(`| ${renaming} | ${totals[0]} of ${trials.length} | ${totals[1]} | ${same} | ${shared} of ${returned} |`)
  }

  console.log('\nTrials per task whose queries bring back a tool that does the task, top 10:')
  console.log('| Task | Product | Trials | As served | Prefix | Label | Brand |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: |')
  for (const task of tasks) {
    const count = (renaming: Renaming) => hits.get(`${renaming} 10`)!.get(task.id) ?? 0
    console.log(`| ${task.id} | ${task.product} | ${trials.filter((trial) => trial.id === task.id).length} | ${count('as served')} | ${count('prefix')} | ${count('label')} | ${count('brand')} |`)
  }
}
