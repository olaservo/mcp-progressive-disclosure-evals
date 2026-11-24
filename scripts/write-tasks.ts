// Has two models this demo does not test write the held-out task set (v3), so no task is worded by someone who has read the
// group descriptions. Each writer sees only a product name from cloudflare/mcp's forge catalog: no group listing, no tool names,
// no tool descriptions. Products are drawn in a seeded order; each writer gets 3 of the 10 subset products and 7 others.
// Accepted answers come from scripts/v3-answers.ts afterwards, from the catalog's tool names, before any model is scored.
// --set workflow writes a second set, results/tasks-workflow/: jobs that take three or four calls. Each writer's tasks
// alternate between two kinds. A `single` job stays in the drawn product. A `cross` job needs the drawn product and one or
// two others the writer picks, since groups are built per product and a job inside one product fits one group. The task
// states the outcome and leaves at least one needed step unsaid, so an agent has to work out a step it was not told.
// Each task comes with the writer's list of steps, marked as stated or not, from which the accepted tools are chosen afterwards.
// --dry prints the prompts and the draw order and calls no model.
// Usage: tsx scripts/write-tasks.ts [--env <.env path>] [--replace <product,product>] [--set workflow] [--dry]
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

const workflow = args.includes('--set') && args[args.indexOf('--set') + 1] === 'workflow'
const dry = args.includes('--dry')
const SEED = workflow ? 20261124 : 20261109
const WRITERS = ['claude-fable-5-2', 'gemini-3.6-flash'] as const
const PER_WRITER = workflow ? { subset: 2, other: 8 } : { subset: 3, other: 7 }
const SUBSET = ['turnstile', 'durableObjects', 'emailRouting', 'emailSending', 'kv', 'r2', 'queues', 'd1', 'workers', 'containers']
const FORGE = join(import.meta.dirname, '..', '.upstream', 'cloudflare-mcp', 'src', 'generated', 'forge-mcp')
const OUT_DIR = join(import.meta.dirname, '..', 'results', workflow ? 'tasks-workflow' : 'tasks-v3')
if (!existsSync(FORGE)) throw new Error('run npm run vendor first, which fetches cloudflare/mcp into .upstream/')

// A product with few tools has no job of three operations. The writer cannot see the count, so the draw leaves those out.
const MIN_TOOLS = workflow ? 6 : 0
const toolCount = (product: string) =>
  (readdirSync(join(FORGE, product), { recursive: true }) as string[])
    .filter((file) => /(^|[\\/])tools\.ts$/.test(file))
    .reduce((sum, file) => sum + (readFileSync(join(FORGE, product, file), 'utf8').match(/^ {4}name: "/gm)?.length ?? 0), 0)
const products = readdirSync(FORGE)
  .filter((name) => name !== '_' && statSync(join(FORGE, name)).isDirectory() && (MIN_TOOLS === 0 || toolCount(name) >= MIN_TOOLS))
  .sort()

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

type Kind = 'single' | 'cross'
const WORKFLOW_RULES: Record<Kind, string[]> = {
  single: [
    '- The job must take three or four API calls to this product, each to a different operation. A later call must depend on what an earlier one did or returned. A read that looks something up counts as a call.',
    '- The calls must touch at least two different kinds of resource in this product. Listing, reading and updating one resource is not enough.',
    '- The whole job must need only this product, not another product of the same platform.'
  ],
  cross: [
    '- The job must take three or four API calls, each to a different operation, spread over this product and one or two other products of the same platform that are commonly used with it. At least one call must go to this product and at least one to another. A later call must depend on what an earlier one did or returned. A read that looks something up counts as a call.',
    '- Pick the other products yourself. The job must be one a developer would really bring as a single request.'
  ]
}
const workflowSystem = (kind: Kind) =>
  [
    'You write test tasks for an evaluation of how AI agents find the right tools on a large cloud platform API.',
    'You are given one product of the Cloudflare API. Write one task a developer might give an agent that has API access to their Cloudflare account, where the job needs this product.',
    'Rules:',
    ...WORKFLOW_RULES[kind],
    '- One to three sentences, in the words a developer would use. Say what they want to end up with. Do not list or number the steps.',
    '- At least one of the calls must be a step the task does not mention and the job cannot be done without, such as creating something that has to exist first or looking up a resource the task refers to by name.',
    '- Refer to existing resources by name, never by ID.',
    '- Do not name any product, Cloudflare, or any API, endpoint or tool. Describe the job, not the products.',
    '- The job must be done by reading or changing resources in the account through the API, not by writing application code.',
    '- Use concrete but invented details (names, domains, numbers) where they help.',
    '- If you do not know this product well enough to write a realistic task, or it has no such job, reply with exactly SKIP.',
    kind === 'single'
      ? 'Otherwise reply with JSON only: {"task": "<the task>", "feature": "<the product feature the task needs, a few words>", "steps": [{"does": "<one API operation the job needs, a few words>", "stated": <true if the task mentions this step, false if not>}]} with the steps in order.'
      : 'Otherwise reply with JSON only: {"task": "<the task>", "feature": "<the product feature the task needs, a few words>", "products": ["<each other product the job needs, by its usual name>"], "steps": [{"product": "<the product this operation belongs to>", "does": "<one API operation the job needs, a few words>", "stated": <true if the task mentions this step, false if not>}]} with the steps in order.'
  ].join('\n')
const V3_SYSTEM = [
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
const SYSTEM = V3_SYSTEM
const prompt = (product: string) => `Product: Cloudflare ${label(product)} (API directory "${product}")`

let anthropic: Anthropic | undefined
let gemini: GoogleGenAI | undefined
async function ask(writer: (typeof WRITERS)[number], product: string, system: string): Promise<string> {
  if (writer.startsWith('claude-')) {
    anthropic ??= new Anthropic()
    const response = await anthropic.messages.create({ model: writer, max_tokens: 4000, system, messages: [{ role: 'user', content: prompt(product) }] })
    return response.content.filter((block) => block.type === 'text').map((block) => block.text).join('').trim()
  }
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await gemini.models.generateContent({ model: writer, contents: prompt(product), config: { systemInstruction: system } })
  return (response.text ?? '').trim()
}

type Step = { does: string; stated: boolean; product?: string }
const parse = (reply: string, kind?: Kind): { task: string; feature: string; steps?: Step[]; products?: string[] } | undefined => {
  if (/^SKIP\b/.test(reply)) return undefined
  const json = /\{[\s\S]*\}/.exec(reply)?.[0]
  if (!json) throw new Error(`unparseable reply: ${reply.slice(0, 200)}`)
  const value = JSON.parse(json) as { task?: unknown; feature?: unknown; steps?: unknown; products?: unknown }
  if (typeof value.task !== 'string' || typeof value.feature !== 'string') throw new Error(`missing fields: ${json.slice(0, 200)}`)
  if (!kind) return { task: value.task, feature: value.feature }
  const steps = value.steps as Step[]
  if (!Array.isArray(steps) || steps.length < 3 || !steps.every((step) => typeof step?.does === 'string' && typeof step.stated === 'boolean')) throw new Error(`fewer than three steps: ${json.slice(0, 200)}`)
  if (steps.every((step) => step.stated)) throw new Error(`every step is stated: ${json.slice(0, 200)}`)
  if (kind === 'single') return { task: value.task, feature: value.feature, steps }
  const products = value.products
  if (!Array.isArray(products) || products.length === 0 || !products.every((item) => typeof item === 'string') || !steps.every((step) => typeof step.product === 'string')) throw new Error(`no other product: ${json.slice(0, 200)}`)
  return { task: value.task, feature: value.feature, products: products as string[], steps }
}

mkdirSync(OUT_DIR, { recursive: true })
const RAW = join(OUT_DIR, 'raw.jsonl')
const TASKS = join(OUT_DIR, 'tasks.json')

type Written = { writer: string; product: string; stratum: 'subset' | 'other'; task: string; feature: string; kind?: Kind; products?: string[]; steps?: Step[]; redraw?: boolean }
const queues = {
  subset: shuffle(products.filter((p) => SUBSET.includes(p)), SEED),
  other: shuffle(products.filter((p) => !SUBSET.includes(p)), SEED + 1)
}

// --replace a,b,c drops those products' tasks and has Fable write one task each for the next undrawn products of the same
// stratum, under two added rules. Used once, on 2026-11-09, for tasks that spanned products, missed their product or
// repeated its name.
const replace = args.includes('--replace') ? args[args.indexOf('--replace') + 1]!.split(',') : undefined
if (dry) {
  console.log(workflow ? `--- single\n${workflowSystem('single')}\n\n--- cross\n${workflowSystem('cross')}` : SYSTEM)
  for (const stratum of ['subset', 'other'] as const) console.log(`\n${stratum}, ${PER_WRITER[stratum]} per writer, draw order: ${queues[stratum].slice(0, 24).join(' ')}`)
  console.log(`\nFirst prompt: ${prompt(queues.subset[0]!)}`)
  process.exit(0)
}
if (replace) {
  if (workflow) throw new Error('--replace is for the v3 set')
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
  console.error(`${out.length} tasks in ${TASKS}`)
  process.exit(0)
}

writeFileSync(RAW, JSON.stringify({ seed: SEED, writers: WRITERS, system: workflow ? { single: workflowSystem('single'), cross: workflowSystem('cross') } : SYSTEM, products: products.length, date: new Date().toISOString() }) + '\n')
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
    // A writer's workflow tasks alternate kind. A skipped product leaves the kind for the next draw.
    const kind: Kind | undefined = workflow ? (written.filter((task) => task.writer === writer).length % 2 === 0 ? 'single' : 'cross') : undefined
    const reply = await ask(writer, product, kind ? workflowSystem(kind) : SYSTEM)
    appendFileSync(RAW, JSON.stringify({ writer, product, stratum, ...(kind && { kind }), prompt: prompt(product), reply }) + '\n')
    const parsed = parse(reply, kind)
    console.error(`${writer} ${product}${kind ? ` ${kind}` : ''}: ${parsed ? parsed.task : 'SKIP'}`)
    if (!parsed) continue
    written.push({ writer, product, stratum, ...(kind && { kind }), ...parsed })
    need[writer]!--
  }
}
writeFileSync(TASKS, JSON.stringify(written, null, 2) + '\n')
console.error(`${written.length} tasks in ${TASKS}`)
