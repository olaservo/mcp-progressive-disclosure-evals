// Runs the held-out tasks against a flat server's whole catalog behind the Messages API's tool search.
// Every tool is sent with `defer_loading` beside the BM25 tool search tool. A trial ends at the model's first call to a
// catalog tool, or when it stops without one. Nothing is executed. Each row records the queries the model wrote, the
// tools the search returned, the tools called and the usage.
// Scored per trial: whether the search returned a tool that does the task, and whether the model called one.
// Usage: tsx scripts/search-run.ts [--url <flat mcp url>] [--models a,b] [--samples N] [--limit N] [--parallel N] [--env <.env path>] [--label name]
//        tsx scripts/search-run.ts --replay <jsonl>
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
const url = opt('url', 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp')!
const models = opt('models', 'claude-haiku-5-5')!.split(',')
const samples = Number(opt('samples', '1'))
const limit = Number(opt('limit', '0'))
const parallel = Number(opt('parallel', '4'))
const label = opt('label', 'v3')!
const replay = opt('replay')

type Task = { id: string; product: string; task: string; tools: string[] }
type Trial = {
  model: string
  sample: number
  id: string
  queries: string[]
  returned: string[]
  called: string[]
  said: string
  stop: string
  requests: number
  inputTokens: number
  outputTokens: number
  ms: number
  error?: string
}
const allTasks = JSON.parse(readFileSync(new URL('../tasks/select-v3.json', import.meta.url), 'utf8')) as Task[]
const tasks = limit ? allTasks.slice(0, limit) : allTasks
const byId = new Map(allTasks.map((task) => [task.id, task]))
// A task's entries are name prefixes, as in v3-answers.ts.
const does = (task: Task, name: string) => task.tools.some((prefix) => name.startsWith(prefix))

// The account and its zones are given so that a model has no reason to stop and ask for an identifier.
const SYSTEM = [
  'You operate a Cloudflare account through tools. Find the tool that does the task and call it.',
  'The account ID is 4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a. For a domain named in the task, use the zone ID 9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d.',
  'Do not ask for identifiers or confirmation. If a value is missing, choose a reasonable one.'
].join(' ')

function summary(trials: Trial[]): void {
  const done = trials.filter((trial) => !trial.error)
  console.log('\n| Model | Trials | Search returned a tool for the task | Called one | Called another tool | Called nothing | Median input tokens | Requests |')
  console.log('| :-- | --: | --: | --: | --: | --: | --: | --: |')
  for (const model of [...new Set(trials.map((trial) => trial.model))]) {
    const rows = done.filter((trial) => trial.model === model)
    const hit = (trial: Trial, names: string[]) => names.some((name) => does(byId.get(trial.id)!, name))
    const tokens = rows.map((trial) => trial.inputTokens).sort((a, b) => a - b)
    console.log(
      `| ${model} | ${rows.length} | ${rows.filter((t) => hit(t, t.returned)).length} | ${rows.filter((t) => hit(t, t.called)).length} | ${rows.filter((t) => t.called.length > 0 && !hit(t, t.called)).length} | ${rows.filter((t) => t.called.length === 0).length} | ${tokens[Math.floor((tokens.length - 1) / 2)] ?? ''} | ${rows.reduce((sum, t) => sum + t.requests, 0)} |`
    )
  }
  console.log('\n| Task | Product | Model | Search returned one | Called | Queries |')
  console.log('| :-- | :-- | :-- | :-- | :-- | :-- |')
  for (const trial of done) {
    const task = byId.get(trial.id)!
    const returned = trial.returned.some((name) => does(task, name))
    const called = trial.called.length === 0 ? '(nothing)' : trial.called.map((name) => (does(task, name) ? name : `MISS ${name}`)).join(', ')
    console.log(`| ${trial.id} | ${task.product} | ${trial.model} #${trial.sample} | ${returned ? 'yes' : 'no'} | ${called} | ${trial.queries.join(' ; ')} |`)
  }
  const failed = trials.filter((trial) => trial.error)
  if (failed.length) console.log(`\n${failed.length} trials ended in an error: ${[...new Set(failed.map((trial) => trial.error!.slice(0, 80)))].join(' | ')}`)
}

if (replay) {
  summary(readFileSync(replay, 'utf8').split('\n').filter(Boolean).slice(1).map((line) => JSON.parse(line) as Trial))
} else {
  const mcp = new Client({ name: 'groups-search-run', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
  await mcp.connect(new StreamableHTTPClientTransport(new URL(url)))
  const listed = []
  let cursor: string | undefined
  do {
    const page = await mcp.listTools(cursor ? { cursor } : undefined)
    listed.push(...page.tools)
    cursor = page.nextCursor
  } while (cursor)
  await mcp.close()
  const names = new Set(listed.map((tool) => tool.name))
  const tools: Anthropic.ToolUnion[] = [
    { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' },
    ...listed.map((tool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true }))
  ]
  const anthropic = new Anthropic({ maxRetries: 4 })

  async function run(model: string, sample: number, task: Task): Promise<Trial> {
    const trial: Trial = { model, sample, id: task.id, queries: [], returned: [], called: [], said: '', stop: '', requests: 0, inputTokens: 0, outputTokens: 0, ms: 0 }
    const started = Date.now()
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task.task }]
    try {
      // A paused turn is resumed with the assistant content so far. Six requests bound a trial.
      while (trial.requests < 6) {
        const response = await anthropic.messages.create({ model, max_tokens: 4000, output_config: { effort: 'low' }, system: SYSTEM, tools, messages })
        trial.requests++
        trial.inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)
        trial.outputTokens += response.usage.output_tokens
        trial.stop = response.stop_reason ?? ''
        for (const block of response.content as Array<Record<string, any>>) {
          if (block.type === 'server_tool_use') trial.queries.push(String(block.input?.query ?? JSON.stringify(block.input)))
          else if (block.type === 'tool_search_tool_result') trial.returned.push(...(block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
          else if (block.type === 'tool_use' && names.has(block.name)) trial.called.push(block.name)
          else if (block.type === 'text') trial.said += block.text
        }
        if (response.stop_reason !== 'pause_turn') break
        messages.push({ role: 'assistant', content: response.content })
      }
    } catch (error) {
      trial.error = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
    }
    trial.said = trial.said.replace(/\s+/g, ' ').slice(0, 400)
    trial.ms = Date.now() - started
    return trial
  }

  mkdirSync('results/search', { recursive: true })
  const out = `results/search/${new Date().toISOString().slice(0, 10)}-search-${label}.jsonl`
  writeFileSync(out, JSON.stringify({ url, tools: listed.length, taskSet: 'v3', tasks: tasks.length, samples, models, search: 'tool_search_tool_bm25_20251119', effort: 'low', system: SYSTEM }) + '\n')
  const queue = models.flatMap((model) => tasks.flatMap((task) => Array.from({ length: samples }, (_, sample) => ({ model, sample: sample + 1, task }))))
  const trials: Trial[] = []
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const trial = await run(job.model, job.sample, job.task)
        trials.push(trial)
        appendFileSync(out, JSON.stringify(trial) + '\n')
        const task = job.task
        process.stderr.write(`${trial.model} #${trial.sample} ${trial.id}: ${trial.error ?? (trial.called.some((name) => does(task, name)) ? 'called' : trial.called.length ? `MISS ${trial.called[0]}` : 'no call')}\n`)
      }
    })
  )
  const order = new Map(tasks.map((task, at) => [task.id, at]))
  summary(trials.sort((a, b) => a.model.localeCompare(b.model) || order.get(a.id)! - order.get(b.id)! || a.sample - b.sample))
  console.log(`\nRaw trials: ${out}`)
}
