// Ranks a flat server's tools against each held-out task with a local BM25, with the task text as the query. No model is called.
// It is a proxy for a host's tool search: a model writes its own query, and a vendor's index may hold other fields.
// For each task it prints the best rank of a tool that does the job, how many of the task's tool entries are in the top 5 and 10,
// and the task's words that appear in those tools' names and descriptions.
// Usage: tsx scripts/search-overlap.ts [--url <flat mcp url>] [--top N]
import { readFileSync } from 'node:fs'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1]! : fallback
}
const url = opt('url', 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp')
type Task = { id: string; product: string; task: string; tools: string[] }
const tasks = JSON.parse(readFileSync(new URL('../tasks/select-v3.json', import.meta.url), 'utf8')) as Task[]

const STOP = new Set('a an the and or of to in on for from with our we it its is are be so that this then me my i you your at by as if not no do does can will want need make sure also all any each every into out up new set show have has their them they us'.split(' '))
// camelCase and snake_case names are split, so `emailSending_subdomains_create` gives email, sending, subdomains, create.
const words = (text: string) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map((word) => word.replace(/(ies)$/, 'y').replace(/(?<=[a-z]{3})s$/, ''))

const mcp = new Client({ name: 'groups-search-overlap', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await mcp.connect(new StreamableHTTPClientTransport(new URL(url)))
const tools: { name: string; description?: string }[] = []
let cursor: string | undefined
do {
  const page = await mcp.listTools(cursor ? { cursor } : undefined)
  tools.push(...page.tools)
  cursor = page.nextCursor
} while (cursor)
await mcp.close()

const docs = tools.map((tool) => words(`${tool.name} ${tool.description ?? ''}`))
const df = new Map<string, number>()
for (const doc of docs) for (const word of new Set(doc)) df.set(word, (df.get(word) ?? 0) + 1)
const avg = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length
const K1 = 1.2
const B = 0.75
function rank(query: string[]): number[] {
  const scores = docs.map((doc) => {
    const tf = new Map<string, number>()
    for (const word of doc) tf.set(word, (tf.get(word) ?? 0) + 1)
    let score = 0
    for (const word of new Set(query)) {
      const f = tf.get(word)
      if (!f) continue
      const idf = Math.log(1 + (docs.length - df.get(word)! + 0.5) / (df.get(word)! + 0.5))
      score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.length) / avg))
    }
    return score
  })
  return scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score).map((entry) => entry.index)
}

console.log(`${tools.length} tools from ${url}, ${tasks.length} tasks`)
console.log('| Task | Product | Tools | Best rank | In top 5 | In top 10 | Shared words |')
console.log('| :-- | :-- | --: | --: | --: | --: | :-- |')
for (const task of tasks) {
  const query = words(task.task)
  const order = rank(query)
  const position = new Map(order.map((at, place) => [at, place + 1]))
  // A task's entries are name prefixes. An entry's rank is the best rank of any tool it covers.
  const covered = task.tools.map((prefix) => tools.map((tool, at) => (tool.name.startsWith(prefix) ? at : -1)).filter((at) => at >= 0))
  const ranks = covered.map((ats) => Math.min(...ats.map((at) => position.get(at)!)))
  const own = new Set(covered.flat().flatMap((at) => docs[at]!))
  const shared = [...new Set(query)].filter((word) => own.has(word))
  console.log(`| ${task.id} | ${task.product} | ${task.tools.length} | ${Math.min(...ranks)} | ${ranks.filter((r) => r <= 5).length} | ${ranks.filter((r) => r <= 10).length} | ${shared.join(' ') || '(none)'} |`)
}
