// Runs the workflow tasks (scripts/workflow-tasks.json) to completion on the Messages API, with the whole catalog sent
// with `defer_loading`, in one of two arms:
//   search  the BM25 tool search tool finds and loads tools, as in search-run.ts. The model sees nothing about the tools first.
//   groups  the rewritten server's group listing is in the system prompt, and a client tool `open_group` answers with
//           `tool_reference` blocks for the group's tools.
// Nothing is executed. A call to a catalog tool gets a made-up result: a list returns one item, with an ID, for each
// resource the key says already exists, whatever kind of thing was listed. Anything else returns an ID and the request body. A trial runs until the model stops or
// --max-requests is reached.
// Scored per step of the answer key: a step is done when a tool that fits it was called, and reachable when such a tool was
// loaded. The made-up results can stall a model, which lowers the first and not the second. The summary also gives searches
// or opens, tools loaded, tools loaded and never called, and input tokens summed over the trial's requests, cached or not.
// Usage: tsx scripts/workflow-run.ts --arm search|groups [--models a,b] [--samples N] [--limit N] [--parallel N] [--max-requests N] [--env <.env path>] [--label name]
//        tsx scripts/workflow-run.ts --replay <jsonl> [<jsonl> ...]
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as z from 'zod/v4'
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
const GROUPED = 'https://pd-groups-opt2-rec-full.olahungerford.workers.dev/mcp'
const GROUPS = 'io.modelcontextprotocol/groups'
const arm = opt('arm', 'search')!
if (arm !== 'search' && arm !== 'groups') throw new Error('--arm is search or groups')
const models = opt('models', 'claude-haiku-5-5')!.split(',')
const samples = Number(opt('samples', '1'))
const limit = Number(opt('limit', '0'))
const parallel = Number(opt('parallel', '4'))
const maxRequests = Number(opt('max-requests', '14'))
const label = opt('label', arm)!

type Step = { does: string; tools: string[]; stated: boolean; optional?: true }
type Task = { id: string; product: string; kind: 'single' | 'cross'; writer: string; task: string; exists: string[]; steps: Step[] }
type Trial = {
  cacheRead?: number
  arm: string
  model: string
  sample: number
  id: string
  /** Search queries in the search arm, group names in the groups arm. */
  finds: string[]
  loaded: string[]
  called: string[]
  said: string
  stop: string
  requests: number
  inputTokens: number
  outputTokens: number
  ms: number
  error?: string
}
const allTasks = JSON.parse(readFileSync(new URL('./workflow-tasks.json', import.meta.url), 'utf8')) as Task[]
const tasks = limit ? allTasks.slice(0, limit) : allTasks
const byId = new Map(allTasks.map((task) => [task.id, task]))
const done = (step: Step, called: string[]) => called.some((name) => step.tools.some((prefix) => name.startsWith(prefix)))
const fits = (task: Task, name: string) => task.steps.some((step) => step.tools.some((prefix) => name.startsWith(prefix)))

const SYSTEM = [
  'You operate a Cloudflare account through tools. Do the whole task the user gives, one step after another, then say it is done.',
  'The account ID is 4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a. Look up any other identifier you need with the tools.',
  'Tool calls are dry runs that return made-up results. Treat each result as real and carry on. A result may lack a field you need. Then assume a plausible value and go on to the next step.',
  'Do not ask for identifiers or confirmation. If a value is missing, choose a reasonable one.'
].join(' ')

const id = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 32)
function madeUp(task: Task, name: string, input: unknown): string {
  if (/_list$|_list[A-Z]|List/.test(name)) {
    const items = task.exists.map((item) => ({ id: id(item), name: item, hostname: item, status: 'active', created_on: '2026-10-02T09:14:00Z' }))
    return JSON.stringify({ success: true, errors: [], result: items, result_info: { page: 1, per_page: 50, count: items.length, total_count: items.length } })
  }
  const body = (input as { body?: unknown } | undefined)?.body
  return JSON.stringify({ success: true, errors: [], result: { id: id(name + JSON.stringify(input)), ...(body && typeof body === 'object' ? body : {}), status: 'active', modified_on: '2026-11-24T10:00:00Z' } })
}

const mean = (values: number[]) => (values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '')
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)] ?? ''
function summary(trials: Trial[]): void {
  const ok = trials.filter((trial) => !trial.error)
  const count = (rows: Trial[], keep: (step: Step, task: Task) => boolean, from: (trial: Trial) => string[] = (trial) => trial.called) => {
    let hit = 0
    let all = 0
    for (const trial of rows) {
      const task = byId.get(trial.id)!
      for (const step of task.steps.filter((step) => !step.optional && keep(step, task))) {
        all++
        if (done(step, from(trial))) hit++
      }
    }
    return `${hit} of ${all}`
  }
  console.log('\n| Arm | Model | Trials | Every required step | Required steps | Stated | Unsaid | Single-product tasks | Cross-product tasks | Steps with a tool loaded | Unsaid steps with a tool loaded | Stopped at the request limit |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
  const cells = [...new Set(ok.map((trial) => `${trial.arm}\t${trial.model}`))]
  for (const cell of cells) {
    const [cellArm, model] = cell.split('\t')
    const rows = ok.filter((trial) => trial.arm === cellArm && trial.model === model)
    const every = rows.filter((trial) => byId.get(trial.id)!.steps.every((step) => step.optional || done(step, trial.called))).length
    console.log(
      `| ${cellArm} | ${model} | ${rows.length} | ${every} | ${count(rows, () => true)} | ${count(rows, (step) => step.stated)} | ${count(rows, (step) => !step.stated)} | ${count(rows, (_, task) => task.kind === 'single')} | ${count(rows, (_, task) => task.kind === 'cross')} | ${count(rows, () => true, (trial) => trial.loaded)} | ${count(rows, (step) => !step.stated, (trial) => trial.loaded)} | ${rows.filter((trial) => trial.requests >= maxRequests && trial.stop !== 'end_turn').length} |`
    )
  }
  console.log('\n| Arm | Model | Searches or opens | Tools loaded | Loaded and never called | Calls to a tool no step accepts | Requests | Median input tokens | Median output tokens |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |')
  for (const cell of cells) {
    const [cellArm, model] = cell.split('\t')
    const rows = ok.filter((trial) => trial.arm === cellArm && trial.model === model)
    console.log(
      `| ${cellArm} | ${model} | ${mean(rows.map((t) => t.finds.length))} | ${mean(rows.map((t) => new Set(t.loaded).size))} | ${mean(rows.map((t) => [...new Set(t.loaded)].filter((name) => !t.called.includes(name)).length))} | ${mean(rows.map((t) => t.called.filter((name) => !fits(byId.get(t.id)!, name)).length))} | ${mean(rows.map((t) => t.requests))} | ${median(rows.map((t) => t.inputTokens))} | ${median(rows.map((t) => t.outputTokens))} |`
    )
  }
  console.log('\n| Task | Kind | Arm | Model | Required steps done | Missed | Searches or opens |')
  console.log('| :-- | :-- | :-- | :-- | --: | :-- | :-- |')
  for (const trial of ok) {
    const task = byId.get(trial.id)!
    const required = task.steps.filter((step) => !step.optional)
    const missed = required.filter((step) => !done(step, trial.called))
    console.log(`| ${trial.id} | ${task.kind} | ${trial.arm} | ${trial.model} #${trial.sample} | ${required.length - missed.length} of ${required.length} | ${missed.map((step) => `${step.does}${step.stated ? '' : ' (unsaid)'}`).join('; ')} | ${trial.finds.join(' ; ')} |`)
  }
  const failed = trials.filter((trial) => trial.error)
  if (failed.length) console.log(`\n${failed.length} trials ended in an error: ${[...new Set(failed.map((trial) => trial.error!.slice(0, 120)))].join(' | ')}`)
}

const replayAt = args.indexOf('--replay')
if (replayAt >= 0) {
  const files = args.slice(replayAt + 1).filter((file) => !file.startsWith('--'))
  summary(files.flatMap((file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(1).map((line) => JSON.parse(line) as Trial)))
} else {
  type Listed = { name: string; description?: string; inputSchema?: unknown }
  const Loose = z.looseObject({})
  const flat = new Client({ name: 'groups-workflow-run', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
  await flat.connect(new StreamableHTTPClientTransport(new URL(FLAT)))
  const listed: Listed[] = []
  let cursor: string | undefined
  do {
    const page = await flat.listTools(cursor ? { cursor } : undefined)
    listed.push(...page.tools)
    cursor = page.nextCursor
  } while (cursor)
  await flat.close()
  const names = new Set(listed.map((tool) => tool.name))

  // The groups arm reads the listing and every group's tools once. The Worker allows 120 requests a minute per client.
  const groups: { name: string; description: string }[] = []
  const members = new Map<string, { tools: string[]; instructions?: string }>()
  if (arm === 'groups') {
    const grouped = new Client({ name: 'groups-workflow-run', version: '0.1.0' }, { capabilities: { extensions: { [GROUPS]: {} } }, versionNegotiation: { mode: 'auto' } })
    await grouped.connect(new StreamableHTTPClientTransport(new URL(GROUPED)))
    groups.push(...((await grouped.request({ method: 'groups/list', params: {} }, Loose)) as unknown as { groups: { name: string; description: string }[] }).groups)
    for (const group of groups) {
      await new Promise((resolve) => setTimeout(resolve, 550))
      const body = (await grouped.request({ method: 'groups/get', params: { name: group.name } }, Loose)) as { tools?: { name: string }[]; instructions?: string }
      members.set(group.name, { tools: (body.tools ?? []).map((tool) => tool.name).filter((name) => names.has(name)), instructions: body.instructions })
    }
    await grouped.close()
    process.stderr.write(`${groups.length} groups, ${new Set([...members.values()].flatMap((group) => group.tools)).size} of ${names.size} tools in a group\n`)
  }
  const system =
    arm === 'search'
      ? SYSTEM
      : `${SYSTEM}\n\nThe tools are in groups. Call open_group with a group's name to load its tools, then call them. Groups:\n${groups.map((group) => `- ${group.name}: ${group.description}`).join('\n')}`
  const first: Anthropic.ToolUnion =
    arm === 'search'
      ? { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' }
      : { name: 'open_group', description: "Load a group's tools by the group's name, so they can be called.", input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } }
  const tools: Anthropic.ToolUnion[] = [first, ...listed.map((tool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true }))]
  const anthropic = new Anthropic({ maxRetries: 4 })

  async function run(model: string, sample: number, task: Task): Promise<Trial> {
    const trial: Trial = { arm, model, sample, id: task.id, finds: [], loaded: [], called: [], said: '', stop: '', requests: 0, inputTokens: 0, outputTokens: 0, ms: 0 }
    const started = Date.now()
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task.task }]
    try {
      while (trial.requests < maxRequests) {
        // Automatic caching, so a trial's later requests read the earlier ones from cache.
        const response = await anthropic.messages.create({ model, max_tokens: 4000, output_config: { effort: 'low' }, cache_control: { type: 'ephemeral' }, system, tools, messages } as Anthropic.MessageCreateParamsNonStreaming)
        trial.requests++
        trial.inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)
        trial.cacheRead = (trial.cacheRead ?? 0) + (response.usage.cache_read_input_tokens ?? 0)
        trial.outputTokens += response.usage.output_tokens
        trial.stop = response.stop_reason ?? ''
        const results: Anthropic.ContentBlockParam[] = []
        const notes: string[] = []
        for (const block of response.content as Array<Record<string, any>>) {
          if (block.type === 'server_tool_use') trial.finds.push(String(block.input?.query ?? JSON.stringify(block.input)))
          else if (block.type === 'tool_search_tool_result') trial.loaded.push(...(block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
          else if (block.type === 'text') trial.said += block.text
          else if (block.type === 'tool_use' && block.name === 'open_group' && arm === 'groups') {
            const name = String(block.input?.name ?? '').trim()
            const group = members.get(name)
            trial.finds.push(name)
            if (!group || group.tools.length === 0) {
              results.push({ type: 'tool_result', tool_use_id: block.id, content: `No group named ${name}.`, is_error: true })
            } else {
              trial.loaded.push(...group.tools)
              results.push({ type: 'tool_result', tool_use_id: block.id, content: group.tools.map((tool) => ({ type: 'tool_reference', tool_name: tool })) } as unknown as Anthropic.ContentBlockParam)
              if (group.instructions) notes.push(`Instructions of group ${name}:\n${group.instructions}`)
            }
          } else if (block.type === 'tool_use') {
            if (names.has(block.name)) trial.called.push(block.name)
            results.push({ type: 'tool_result', tool_use_id: block.id, content: names.has(block.name) ? madeUp(task, block.name, block.input) : `No tool named ${block.name}.`, ...(names.has(block.name) ? {} : { is_error: true }) })
          }
        }
        if (response.stop_reason !== 'pause_turn' && response.stop_reason !== 'tool_use') break
        messages.push({ role: 'assistant', content: response.content })
        if (results.length) messages.push({ role: 'user', content: [...results, ...notes.map((text) => ({ type: 'text' as const, text }))] })
      }
    } catch (error) {
      trial.error = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
    }
    trial.said = trial.said.replace(/\s+/g, ' ').slice(0, 600)
    trial.ms = Date.now() - started
    return trial
  }

  mkdirSync('results', { recursive: true })
  const out = `results/${new Date().toISOString().slice(0, 10)}-workflow-${label}.jsonl`
  writeFileSync(out, JSON.stringify({ arm, flat: FLAT, grouped: arm === 'groups' ? GROUPED : undefined, tools: listed.length, groups: groups.length || undefined, tasks: tasks.length, samples, models, maxRequests, effort: 'low', system }) + '\n')
  const queue = models.flatMap((model) => tasks.flatMap((task) => Array.from({ length: samples }, (_, sample) => ({ model, sample: sample + 1, task }))))
  const trials: Trial[] = []
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const trial = await run(job.model, job.sample, job.task)
        trials.push(trial)
        appendFileSync(out, JSON.stringify(trial) + '\n')
        const required = job.task.steps.filter((step) => !step.optional)
        process.stderr.write(`${trial.model} #${trial.sample} ${trial.id}: ${trial.error ?? `${required.filter((step) => done(step, trial.called)).length} of ${required.length} steps, ${trial.requests} requests`}\n`)
      }
    })
  )
  const order = new Map(tasks.map((task, at) => [task.id, at]))
  summary(trials.sort((a, b) => a.model.localeCompare(b.model) || order.get(a.id)! - order.get(b.id)! || a.sample - b.sample))
  console.log(`\nRaw trials: ${out}`)
}
