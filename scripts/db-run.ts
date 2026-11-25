// Runs the database tasks (scripts/db-tasks.json) on the Messages API with two servers attached at once: the flat
// Cloudflare catalog and a local MCP Toolbox for Databases server on a Postgres database. Every tool of both is sent
// with `defer_loading`, in one of two arms:
//   search  the BM25 tool search tool finds and loads tools. The model sees nothing about the tools first.
//   groups  both servers' group listings are in the system prompt: the rewritten Cloudflare server's groups, and the
//           toolbox's own groups through its `com.google.cloud/toolbox.v1` extension, which have names and no
//           descriptions. A client tool `open_group` answers with `tool_reference` blocks for the group's tools.
// Toolbox calls are executed against the database. Cloudflare calls are dry runs with a made-up result.
// Before each trial the database is reset from scripts/db/seed.sql, so trials run one at a time. After it, the task's
// check query is run in the database and the trial passes when it returns true.
// Usage: tsx scripts/db-run.ts --arm search|groups [--models a,b] [--samples N] [--limit N] [--max-requests N]
//          [--toolbox http://127.0.0.1:5055/mcp] [--container pd-toolbox-pg] [--env <.env path>] [--label name]
//        tsx scripts/db-run.ts --replay <jsonl> [<jsonl> ...]
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const TOOLBOX = 'com.google.cloud/toolbox.v1'
const arm = opt('arm', 'search')!
if (arm !== 'search' && arm !== 'groups') throw new Error('--arm is search or groups')
const models = opt('models', 'claude-haiku-5-5')!.split(',')
const samples = Number(opt('samples', '1'))
const limit = Number(opt('limit', '0'))
const maxRequests = Number(opt('max-requests', '16'))
const toolboxUrl = opt('toolbox', 'http://127.0.0.1:5055/mcp')!
const container = opt('container', 'pd-toolbox-pg')!
const label = opt('label', arm)!

type Task = { id: string; task: string; setup?: 'blocker'; check: string; tools: string[] }
type Trial = {
  arm: string
  model: string
  sample: number
  id: string
  pass: boolean
  /** Search queries in the search arm, `server/group` in the groups arm. */
  finds: string[]
  loaded: string[]
  /** Each call with its server, arguments and whether the result was an error. */
  calls: { server: 'shop-db' | 'cloudflare'; name: string; input: unknown; error?: true }[]
  said: string
  stop: string
  requests: number
  inputTokens: number
  cacheRead: number
  outputTokens: number
  ms: number
  error?: string
}
const allTasks = JSON.parse(readFileSync(new URL('./db-tasks.json', import.meta.url), 'utf8')) as Task[]
const tasks = limit ? allTasks.slice(0, limit) : allTasks

const SYSTEM = [
  'You operate a Cloudflare account and a PostgreSQL database named shop through tools from two servers, cloudflare and shop-db. Do the whole task the user gives, one step after another, then say it is done.',
  'The Cloudflare account ID is 4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a.',
  'Calls to the database tools run against the real database. Do not ask for identifiers or confirmation. If a value is missing, look it up or choose a reasonable one.'
].join(' ')

const mean = (values: number[]) => (values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '')
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)] ?? ''
function summary(trials: Trial[]): void {
  const ok = trials.filter((trial) => !trial.error)
  const cells = [...new Set(ok.map((trial) => `${trial.arm}\t${trial.model}`))]
  const rowsOf = (cell: string) => ok.filter((trial) => `${trial.arm}\t${trial.model}` === cell)
  const db = (trial: Trial) => trial.calls.filter((call) => call.server === 'shop-db')
  console.log('\n| Arm | Model | Trials | Passed the check | Loaded a database tool | Called one | Called a Cloudflare tool | Database calls | Database calls that returned an error |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: |')
  for (const cell of cells) {
    const rows = rowsOf(cell)
    console.log(
      `| ${cell.replace('\t', ' | ')} | ${rows.length} | ${rows.filter((t) => t.pass).length} | ${rows.filter((t) => t.loaded.some((name) => dbNames.has(name))).length} | ${rows.filter((t) => db(t).length).length} | ${rows.filter((t) => t.calls.some((call) => call.server === 'cloudflare')).length} | ${mean(rows.map((t) => db(t).length))} | ${mean(rows.map((t) => db(t).filter((call) => call.error).length))} |`
    )
  }
  console.log('\n| Arm | Model | Searches or opens | Tools loaded | Database tools loaded | Loaded and never called | Requests | Median input tokens | Mean input tokens | Median output tokens |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: |')
  for (const cell of cells) {
    const rows = rowsOf(cell)
    console.log(
      `| ${cell.replace('\t', ' | ')} | ${mean(rows.map((t) => t.finds.length))} | ${mean(rows.map((t) => new Set(t.loaded).size))} | ${mean(rows.map((t) => [...new Set(t.loaded)].filter((name) => dbNames.has(name)).length))} | ${mean(rows.map((t) => [...new Set(t.loaded)].filter((name) => !t.calls.some((call) => call.name === name)).length))} | ${mean(rows.map((t) => t.requests))} | ${median(rows.map((t) => t.inputTokens))} | ${Math.round(Number(mean(rows.map((t) => t.inputTokens))))} | ${median(rows.map((t) => t.outputTokens))} |`
    )
  }
  console.log('\n| Task | Arm | Model | Passed | Searches or opens | Calls |')
  console.log('| :-- | :-- | :-- | :-- | :-- | :-- |')
  for (const trial of ok) console.log(`| ${trial.id} | ${trial.arm} | ${trial.model} #${trial.sample} | ${trial.pass ? 'yes' : 'no'} | ${trial.finds.join(' ; ')} | ${trial.calls.map((call) => `${call.name}${call.error ? ' (error)' : ''}`).join(', ')} |`)
  const failed = trials.filter((trial) => trial.error)
  if (failed.length) console.log(`\n${failed.length} trials ended in an error: ${[...new Set(failed.map((trial) => trial.error!.slice(0, 120)))].join(' | ')}`)
}

// The toolbox's tool names, for the summary. Filled from the run header on replay.
let dbNames = new Set<string>()

const replayAt = args.indexOf('--replay')
if (replayAt >= 0) {
  const files = args.slice(replayAt + 1).filter((file) => !file.startsWith('--'))
  const trials: Trial[] = []
  for (const file of files) {
    const [head, ...rows] = readFileSync(file, 'utf8').split('\n').filter(Boolean)
    for (const name of (JSON.parse(head!) as { dbTools: string[] }).dbTools) dbNames.add(name)
    trials.push(...rows.map((line) => JSON.parse(line) as Trial))
  }
  summary(trials)
} else {
  type Listed = { name: string; description?: string; inputSchema?: unknown }
  const Loose = z.looseObject({})
  const listAll = async (client: Client) => {
    const out: Listed[] = []
    let cursor: string | undefined
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined)
      out.push(...page.tools)
      cursor = page.nextCursor
    } while (cursor)
    return out
  }
  const flat = new Client({ name: 'groups-db-run', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
  await flat.connect(new StreamableHTTPClientTransport(new URL(FLAT)))
  const cloudflare = await listAll(flat)
  await flat.close()
  const toolbox = new Client({ name: 'groups-db-run', version: '0.1.0' }, { capabilities: { extensions: { [TOOLBOX]: {} } }, versionNegotiation: { mode: 'auto' } })
  await toolbox.connect(new StreamableHTTPClientTransport(new URL(toolboxUrl)))
  const database = await listAll(toolbox)
  dbNames = new Set(database.map((tool) => tool.name))
  const cfNames = new Set(cloudflare.map((tool) => tool.name))
  const clash = database.filter((tool) => cfNames.has(tool.name))
  if (clash.length) throw new Error(`tool names on both servers: ${clash.map((tool) => tool.name).join(', ')}`)
  process.stderr.write(`${cloudflare.length} cloudflare tools, ${database.length} shop-db tools\n`)

  // The server checks an `Mcp-Name` header against `params.name`, and the client library sets none for a method it
  // does not know, so the toolbox's `groups/get` is posted directly.
  async function toolboxGroup(name: string): Promise<string[]> {
    const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'groups-db-run', version: '0.1.0' }, 'io.modelcontextprotocol/clientCapabilities': { extensions: { [TOOLBOX]: {} } } }
    const response = await fetch(toolboxUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'groups/get', 'mcp-name': name },
      body: JSON.stringify({ jsonrpc: '2.0', id: `get-${name}`, method: 'groups/get', params: { name, _meta: meta } })
    })
    const text = await response.text()
    const json = JSON.parse(text.startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data:'))!.slice(5)) as { result?: { tools?: { name: string }[] }; error?: { message: string } }
    if (json.error) throw new Error(json.error.message)
    return (json.result?.tools ?? []).map((tool) => tool.name)
  }

  // Groups of both servers, keyed `server/name`. The Cloudflare Worker allows 120 requests a minute per client, so its
  // 271 groups are read once and kept in the temp directory.
  type Group = { server: string; name: string; description?: string; tools: string[] }
  const groups: Group[] = []
  if (arm === 'groups') {
    const cache = join(tmpdir(), 'pd-groups-opt2-rec-full.json')
    if (existsSync(cache)) groups.push(...(JSON.parse(readFileSync(cache, 'utf8')) as Group[]))
    else {
      const grouped = new Client({ name: 'groups-db-run', version: '0.1.0' }, { capabilities: { extensions: { [GROUPS]: {} } }, versionNegotiation: { mode: 'auto' } })
      await grouped.connect(new StreamableHTTPClientTransport(new URL(GROUPED)))
      const listed = ((await grouped.request({ method: 'groups/list', params: {} }, Loose)) as unknown as { groups: { name: string; description: string }[] }).groups
      for (const group of listed) {
        await new Promise((resolve) => setTimeout(resolve, 550))
        const body = (await grouped.request({ method: 'groups/get', params: { name: group.name } }, Loose)) as { tools?: { name: string }[] }
        groups.push({ server: 'cloudflare', name: group.name, description: group.description, tools: (body.tools ?? []).map((tool) => tool.name).filter((name) => cfNames.has(name)) })
      }
      await grouped.close()
      writeFileSync(cache, JSON.stringify(groups))
    }
    const listed = ((await toolbox.request({ method: 'groups/list', params: {} }, Loose)) as unknown as { groups: { name: string; description?: string }[] }).groups
    for (const group of listed) groups.push({ server: 'shop-db', name: group.name, description: group.description, tools: await toolboxGroup(group.name) })
    process.stderr.write(`${groups.filter((group) => group.server === 'cloudflare').length} cloudflare groups, ${groups.filter((group) => group.server === 'shop-db').length} shop-db groups\n`)
  }
  const line = (group: Group) => `- ${group.name}${group.description ? `: ${group.description}` : ''}`
  const system =
    arm === 'search'
      ? SYSTEM
      : `${SYSTEM}\n\nThe tools are in groups. Call open_group with a server and a group's name to load its tools, then call them.\n\nGroups of server cloudflare:\n${groups.filter((group) => group.server === 'cloudflare').map(line).join('\n')}\n\nGroups of server shop-db:\n${groups.filter((group) => group.server === 'shop-db').map(line).join('\n')}`
  const first: Anthropic.ToolUnion =
    arm === 'search'
      ? { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' }
      : { name: 'open_group', description: "Load a group's tools by its server and the group's name, so they can be called.", input_schema: { type: 'object', properties: { server: { type: 'string', enum: ['cloudflare', 'shop-db'] }, name: { type: 'string' } }, required: ['server', 'name'] } }
  const tools: Anthropic.ToolUnion[] = [first, ...[...cloudflare, ...database].map((tool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true }))]
  const anthropic = new Anthropic({ maxRetries: 4 })

  const psql = (sql: string, input?: string) => execFileSync('docker', ['exec', '-i', container, 'psql', '-q', '-U', 'postgres', '-d', 'shop', '-At', ...(input === undefined ? ['-c', sql] : ['-f', '-'])], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const seed = readFileSync(new URL('./db/seed.sql', import.meta.url), 'utf8')
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  async function reset(task: Task): Promise<void> {
    psql('', seed)
    if (task.setup === 'blocker') {
      // A session that updates one product row and holds its transaction open.
      spawn('docker', ['exec', container, 'psql', '-q', 'dbname=shop user=postgres application_name=pd-blocker', '-c', "UPDATE products SET price = price WHERE sku = 'SKU-0001'; SELECT pg_sleep(86400)"], { stdio: 'ignore', detached: true }).unref()
      await pause(1500)
    }
    await pause(500)
  }

  async function run(model: string, sample: number, task: Task): Promise<Trial> {
    const trial: Trial = { arm, model, sample, id: task.id, pass: false, finds: [], loaded: [], calls: [], said: '', stop: '', requests: 0, inputTokens: 0, cacheRead: 0, outputTokens: 0, ms: 0 }
    await reset(task)
    const started = Date.now()
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task.task }]
    let maxTokens = 4000
    try {
      while (trial.requests < maxRequests) {
        const response = await anthropic.messages.stream({ model, max_tokens: maxTokens, output_config: { effort: 'low' }, cache_control: { type: 'ephemeral' }, system, tools, messages } as Anthropic.MessageStreamParams).finalMessage()
        trial.requests++
        trial.inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0)
        trial.cacheRead += response.usage.cache_read_input_tokens ?? 0
        trial.outputTokens += response.usage.output_tokens
        trial.stop = response.stop_reason ?? ''
        // A reply cut off at the limit is dropped and the request sent again, once, with four times the limit.
        if (response.stop_reason === 'max_tokens' && maxTokens < 16000) {
          maxTokens *= 4
          continue
        }
        const results: Anthropic.ContentBlockParam[] = []
        for (const block of response.content as Array<Record<string, any>>) {
          if (block.type === 'server_tool_use') trial.finds.push(String(block.input?.query ?? JSON.stringify(block.input)))
          else if (block.type === 'tool_search_tool_result') trial.loaded.push(...(block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
          else if (block.type === 'text') trial.said += block.text
          else if (block.type === 'tool_use' && block.name === 'open_group' && arm === 'groups') {
            const key = `${String(block.input?.server ?? '').trim()}/${String(block.input?.name ?? '').trim()}`
            const group = groups.find((entry) => `${entry.server}/${entry.name}` === key)
            trial.finds.push(key)
            if (!group || group.tools.length === 0) results.push({ type: 'tool_result', tool_use_id: block.id, content: `No group ${key}.`, is_error: true })
            else {
              trial.loaded.push(...group.tools)
              results.push({ type: 'tool_result', tool_use_id: block.id, content: group.tools.map((tool) => ({ type: 'tool_reference', tool_name: tool })) } as unknown as Anthropic.ContentBlockParam)
            }
          } else if (block.type === 'tool_use' && dbNames.has(block.name)) {
            let text: string
            let failed = false
            try {
              const result = (await toolbox.callTool({ name: block.name, arguments: block.input ?? {} })) as { content?: { type: string; text?: string }[]; isError?: boolean }
              text = (result.content ?? []).map((part) => part.text ?? '').join('\n') || '(no rows)'
              failed = result.isError === true
            } catch (error) {
              text = String(error)
              failed = true
            }
            trial.calls.push({ server: 'shop-db', name: block.name, input: block.input, ...(failed ? { error: true as const } : {}) })
            results.push({ type: 'tool_result', tool_use_id: block.id, content: text.length > 20000 ? `${text.slice(0, 20000)}\n(cut at 20,000 characters)` : text, ...(failed ? { is_error: true } : {}) })
          } else if (block.type === 'tool_use' && cfNames.has(block.name)) {
            trial.calls.push({ server: 'cloudflare', name: block.name, input: block.input })
            results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ success: true, errors: [], messages: [], result: /_list$|_list[A-Z]/.test(block.name) ? [] : { ...(block.input?.body ?? {}), modified_on: '2026-11-25T10:00:00Z' } }) })
          } else if (block.type === 'tool_use') {
            results.push({ type: 'tool_result', tool_use_id: block.id, content: `No tool named ${block.name}.`, is_error: true })
          }
        }
        if (response.stop_reason !== 'pause_turn' && response.stop_reason !== 'tool_use') break
        messages.push({ role: 'assistant', content: response.content })
        if (results.length) messages.push({ role: 'user', content: results })
      }
    } catch (error) {
      trial.error = error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : String(error)
    }
    trial.ms = Date.now() - started
    // Table statistics reach the views a moment after the statement that changed them.
    await pause(1500)
    try {
      trial.pass = psql(task.check) === 't'
    } catch (error) {
      trial.error ??= `check: ${String(error).slice(0, 200)}`
    }
    trial.said = trial.said.replace(/\s+/g, ' ').slice(0, 600)
    return trial
  }

  mkdirSync('results', { recursive: true })
  const out = `results/${new Date().toISOString().slice(0, 10)}-db-${label}.jsonl`
  writeFileSync(out, JSON.stringify({ arm, flat: FLAT, grouped: arm === 'groups' ? GROUPED : undefined, toolbox: toolbox.getServerVersion(), tools: cloudflare.length + database.length, dbTools: [...dbNames], groups: groups.length || undefined, tasks: tasks.length, samples, models, maxRequests, effort: 'low', system }) + '\n')
  const trials: Trial[] = []
  for (const model of models) {
    for (const task of tasks) {
      for (let sample = 1; sample <= samples; sample++) {
        const trial = await run(model, sample, task)
        trials.push(trial)
        appendFileSync(out, JSON.stringify(trial) + '\n')
        process.stderr.write(`${model} #${sample} ${task.id}: ${trial.error ?? (trial.pass ? 'pass' : 'fail')}, ${trial.calls.length} calls, ${trial.requests} requests\n`)
      }
    }
  }
  await toolbox.close()
  psql('', seed)
  summary(trials)
  process.stderr.write(`rows in ${out}\n`)
}
