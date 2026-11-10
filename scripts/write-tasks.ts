// Has two models this demo does not test write the held-out task set (v3), so no task is worded by someone who has read the
// group descriptions. Each writer sees only a product name from cloudflare/mcp's forge catalog: no group listing, no tool names,
// no tool descriptions. Products are drawn in a seeded order; each writer gets 3 of the 10 subset products and 7 others.
// Accepted answers are added by hand to scripts/select.ts afterwards, from the catalog's tool paths, before any model is scored.
// Usage: tsx scripts/write-tasks.ts [--env <.env path>] [--replace <product,product>]
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'

const args = process.argv.slice(2)
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : undefined
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}

const SEED = 20261109
const WRITERS = ['claude-fable-5-2', 'gemini-3.6-flash'] as const
const PER_WRITER = { subset: 3, other: 7 }
const SUBSET = ['turnstile', 'durableObjects', 'emailRouting', 'emailSending', 'kv', 'r2', 'queues', 'd1', 'workers', 'containers']
const FORGE = join(import.meta.dirname, '..', '.upstream', 'cloudflare-mcp', 'src', 'generated', 'forge-mcp')
const OUT_DIR = join(import.meta.dirname, '..', 'results', 'tasks-v3')
if (!existsSync(FORGE)) throw new Error('run npm run vendor first, which fetches cloudflare/mcp into .upstream/')

const products = readdirSync(FORGE).filter((name) => name !== '_' && statSync(join(FORGE, name)).isDirectory()).sort()

// mulberry32, so the draw order is reproducible from SEED.
function shuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const label = (product: string) => product.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()

const SYSTEM = [
  'You write test tasks for an evaluation of how AI agents find the right tools on a large cloud platform API.',
  'You are given one product of the Cloudflare API. Write one task a developer might give an agent that has API access to their Cloudflare account, where the job needs this product.',
  'Rules:',
  '- One or two sentences, in the words a developer would use to describe what they want done.',
  '- Do not name the product, Cloudflare, or any API, endpoint or tool. Describe the job, not the product.',
  '- The job must be done by reading or changing resources in the account through the API, not by writing application code.',
  '- Use concrete but invented details (names, domains, numbers) where they help.',
  '- If you do not know this product well enough to write a realistic task, reply with exactly SKIP.',
  'Otherwise reply with JSON only: {"task": "<the task>", "feature": "<the product feature the task needs, a few words>"}'
].join('\n')
const prompt = (product: string) => `Product: Cloudflare ${label(product)} (API directory "${product}")`

let anthropic: Anthropic | undefined
let gemini: GoogleGenAI | undefined
async function ask(writer: (typeof WRITERS)[number], product: string): Promise<string> {
  if (writer.startsWith('claude-')) {
    anthropic ??= new Anthropic()
    const response = await anthropic.messages.create({ model: writer, max_tokens: 4000, system: SYSTEM, messages: [{ role: 'user', content: prompt(product) }] })
    return response.content.filter((block) => block.type === 'text').map((block) => block.text).join('').trim()
  }
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await gemini.models.generateContent({ model: writer, contents: prompt(product), config: { systemInstruction: SYSTEM } })
  return (response.text ?? '').trim()
}

const parse = (reply: string): { task: string; feature: string } | undefined => {
  if (/^SKIP\b/.test(reply)) return undefined
  const json = /\{[\s\S]*\}/.exec(reply)?.[0]
  if (!json) throw new Error(`unparseable reply: ${reply.slice(0, 200)}`)
  const value = JSON.parse(json) as { task?: unknown; feature?: unknown }
  if (typeof value.task !== 'string' || typeof value.feature !== 'string') throw new Error(`missing fields: ${json.slice(0, 200)}`)
  return { task: value.task, feature: value.feature }
}

mkdirSync(OUT_DIR, { recursive: true })
const RAW = join(OUT_DIR, 'raw.jsonl')
const TASKS = join(OUT_DIR, 'tasks.json')

type Written = { writer: string; product: string; stratum: 'subset' | 'other'; task: string; feature: string; redraw?: boolean }
const queues = {
  subset: shuffle(products.filter((p) => SUBSET.includes(p)), SEED),
  other: shuffle(products.filter((p) => !SUBSET.includes(p)), SEED + 1)
}

// --replace a,b,c drops those products' tasks and has Fable write one task each for the next undrawn products of the same
// stratum, under two added rules. Used once, on 2026-11-09, for tasks that spanned products, missed their product or
// repeated its name.
const replace = args.includes('--replace') ? args[args.indexOf('--replace') + 1]!.split(',') : undefined
if (replace) {
  const REDRAW_RULES = [
    '- The whole job must need only this product, not another product of the same platform.',
    "- Do not use any word from the product's name or its API directory name."
  ].join('\n')
  const system = SYSTEM.replace('Otherwise reply', `${REDRAW_RULES}\nOtherwise reply`)
  const kept = (JSON.parse(readFileSync(TASKS, 'utf8')) as Written[]).filter((t) => !replace.includes(t.product))
  const dropped = (JSON.parse(readFileSync(TASKS, 'utf8')) as Written[]).filter((t) => replace.includes(t.product))
  if (dropped.length !== replace.length) throw new Error('--replace names a product with no task')
  const drawn = new Set(readFileSync(RAW, 'utf8').split('\n').filter(Boolean).map((line) => (JSON.parse(line) as { product?: string }).product).filter(Boolean))
  appendFileSync(RAW, JSON.stringify({ redraw: replace, writer: WRITERS[0], system, date: new Date().toISOString() }) + '\n')
  const out = [...kept]
  for (const old of dropped) {
    for (;;) {
      const product = queues[old.stratum].find((p) => !drawn.has(p))
      if (!product) throw new Error(`ran out of ${old.stratum} products`)
      drawn.add(product)
      anthropic ??= new Anthropic()
      const response = await anthropic.messages.create({ model: WRITERS[0], max_tokens: 4000, system, messages: [{ role: 'user', content: prompt(product) }] })
      const reply = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('').trim()
      appendFileSync(RAW, JSON.stringify({ writer: WRITERS[0], product, stratum: old.stratum, prompt: prompt(product), reply, replaces: old.product }) + '\n')
      const parsed = parse(reply)
      console.error(`${WRITERS[0]} ${product} (for ${old.product}): ${parsed ? parsed.task : 'SKIP'}`)
      if (!parsed) continue
      out.push({ writer: WRITERS[0], product, stratum: old.stratum, ...parsed, redraw: true })
      break
    }
  }
  writeFileSync(TASKS, JSON.stringify(out, null, 2) + '\n')
  console.error(`${out.length} tasks in results/tasks-v3/tasks.json`)
  process.exit(0)
}

writeFileSync(RAW, JSON.stringify({ seed: SEED, writers: WRITERS, system: SYSTEM, products: products.length, date: new Date().toISOString() }) + '\n')
const written: Written[] = []
for (const stratum of ['subset', 'other'] as const) {
  const queue = queues[stratum]
  // Writers take turns drawing from the same queue, so no product is used twice.
  const need = Object.fromEntries(WRITERS.map((w) => [w, PER_WRITER[stratum]])) as Record<string, number>
  let turn = 0
  while (WRITERS.some((w) => need[w]! > 0)) {
    const writer = WRITERS[turn++ % WRITERS.length]!
    if (need[writer] === 0) continue
    const product = queue.shift()
    if (!product) throw new Error(`ran out of ${stratum} products`)
    const reply = await ask(writer, product)
    appendFileSync(RAW, JSON.stringify({ writer, product, stratum, prompt: prompt(product), reply }) + '\n')
    const parsed = parse(reply)
    console.error(`${writer} ${product}: ${parsed ? parsed.task : 'SKIP'}`)
    if (!parsed) continue
    written.push({ writer, product, stratum, ...parsed })
    need[writer]!--
  }
}
writeFileSync(TASKS, JSON.stringify(written, null, 2) + '\n')
console.error(`${written.length} tasks in results/tasks-v3/tasks.json`)
