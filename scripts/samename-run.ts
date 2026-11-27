// Runs lookups on three servers that serve the same tools: three local MCP Toolbox for Databases servers, each on its own
// database (shop_us, shop_eu, shop_staging) in one Postgres container. The client names each tool as Claude Code does,
// `mcp__<server>__<tool>`, so the three copies differ only in that prefix. Their descriptions and schemas are the same.
// Each database is seeded from tasks/db/samename-seed.sql with different names and values, so a lookup has a different
// answer in each. Every tool is sent with `defer_loading`, in one of two arms:
//   search  the BM25 tool search tool finds and loads tools.
//   groups  each server's groups, read through the toolbox's `com.google.cloud/toolbox.v1` extension, are listed in the
//           system prompt by server. They have names and no descriptions. A client tool `open_group` takes a server and
//           a group and answers with `tool_reference` blocks.
// A task names one database. A trial passes when a tool on that database's server was called and what the model said
// holds every answer pattern for that database. Calls to the other servers are counted. The lookups are read-only.
// `execute_sql` is left out by default, so a lookup needs a narrow tool.
// Usage: tsx scripts/samename-run.ts --arm search|groups [--models a,b] [--samples N] [--limit N] [--max-requests N]
//          [--without execute_sql] [--toolbox-bin <path>] [--container pd-toolbox-pg] [--env <.env path>] [--label name] [--dry]
//        tsx scripts/samename-run.ts --replay <jsonl> [<jsonl> ...]
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, openSync } from 'node:fs'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
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
const TOOLBOX = 'com.google.cloud/toolbox.v1'
const arm = opt('arm', 'search')!
if (arm !== 'search' && arm !== 'groups') throw new Error('--arm is search or groups')
const models = opt('models', 'claude-haiku-5-5')!.split(',')
const samples = Number(opt('samples', '1'))
const limit = Number(opt('limit', '0'))
const maxRequests = Number(opt('max-requests', '16'))
const container = opt('container', 'pd-toolbox-pg')!
const toolboxBin = opt('toolbox-bin', 'C:/Users/johnn/.cache/mcp-toolbox/v1.18.0/toolbox.exe')!
const label = opt('label', arm)!
const without = new Set(opt('without', 'execute_sql')!.split(',').filter(Boolean))

type Database = { server: string; database: string; port: number; said: string; values: Record<string, string> }
const DATABASES: Database[] = [
  {
    server: 'shop-us', database: 'shop_us', port: 5071, said: 'US store',
    values: { SEQ: '100', DEAD_TABLE: 'sessions', DEAD_ROWS_LOADED: '60000', DEAD_ROWS_KEPT: '5000', INVALID_INDEX: 'orders_status_created_idx', INVALID_COLUMNS: 'status, created_at', UNUSED_INDEX: 'order_items_qty_idx', UNUSED_COLUMNS: 'qty', TRIGGER: 'customers_audit', VIEW_COLUMN: 'c.name AS customer_name', PROCEDURE: 'purge_stale_sessions', PUB: 'us_orders_pub', PUB_TABLES: 'orders, order_items' }
  },
  {
    server: 'shop-eu', database: 'shop_eu', port: 5072, said: 'EU store',
    values: { SEQ: '250', DEAD_TABLE: 'carts', DEAD_ROWS_LOADED: '40000', DEAD_ROWS_KEPT: '8000', INVALID_INDEX: 'orders_total_created_idx', INVALID_COLUMNS: 'total, created_at', UNUSED_INDEX: 'order_items_product_idx', UNUSED_COLUMNS: 'product_id', TRIGGER: 'customers_history', VIEW_COLUMN: 'c.email AS customer_email', PROCEDURE: 'purge_abandoned_carts', PUB: 'eu_orders_pub', PUB_TABLES: 'orders, customers' }
  },
  {
    server: 'shop-staging', database: 'shop_staging', port: 5073, said: 'staging',
    values: { SEQ: '40', DEAD_TABLE: 'login_attempts', DEAD_ROWS_LOADED: '20000', DEAD_ROWS_KEPT: '2500', INVALID_INDEX: 'orders_customer_status_idx', INVALID_COLUMNS: 'customer_id, status', UNUSED_INDEX: 'order_items_qty_product_idx', UNUSED_COLUMNS: 'qty, product_id', TRIGGER: 'customers_changes', VIEW_COLUMN: "'staging'::text AS environment", PROCEDURE: 'purge_login_attempts', PUB: 'staging_items_pub', PUB_TABLES: 'order_items' }
  }
]

/** Lookups from tasks/db-find-tasks.json that depend on the database, not the server. `{db}` is the database as the task names it. */
type Lookup = { id: string; task: string; answer: (db: Database) => string[]; tools: string[] }
const v = (db: Database, key: string) => db.values[key]!
const LOOKUPS: Lookup[] = [
  { id: 'invalid-index', task: 'In the {db} database, an index build on the orders table failed a while ago and left an unusable index behind. Which index is it?', answer: (db) => [v(db, 'INVALID_INDEX')], tools: ['list_invalid_indexes', 'list_indexes', 'list_tables'] },
  { id: 'dead-rows', task: 'One table in the {db} database is mostly dead rows. Which table is it, and how many dead rows does it have?', answer: (db) => { const dead = Number(v(db, 'DEAD_ROWS_LOADED')) - Number(v(db, 'DEAD_ROWS_KEPT')); return [v(db, 'DEAD_TABLE'), `${Math.floor(dead / 1000)}[,.]?${String(dead % 1000).padStart(3, '0')}|${dead / 1000}k`] }, tools: ['list_top_bloated_tables', 'list_table_stats'] },
  { id: 'unused-index', task: 'In the {db} database, which index on order_items has never been scanned?', answer: (db) => [v(db, 'UNUSED_INDEX')], tools: ['list_indexes'] },
  { id: 'audit-trigger', task: 'In the {db} database, changes to customers have stopped showing up in the audit log. Which trigger should be recording them, and what state is it in?', answer: (db) => [v(db, 'TRIGGER'), 'disabled|not enabled|turned off|switched off'], tools: ['list_triggers', 'list_tables'] },
  { id: 'order-ids', task: 'In the {db} database, new orders fail with a duplicate key error on the order ID. What is the last value of the sequence behind the orders ID column?', answer: (db) => [`\\b${v(db, 'SEQ')}\\b`], tools: ['list_sequences'] },
  { id: 'view-columns', task: 'In the {db} database, which columns does the order_summary view return?', answer: (db) => ['order_id', v(db, 'VIEW_COLUMN').split(' AS ')[1]!], tools: ['list_views', 'list_tables'] },
  { id: 'procedure', task: 'Is there a stored procedure in the {db} database that clears out old rows? Give its name.', answer: (db) => [v(db, 'PROCEDURE')], tools: ['list_stored_procedure'] },
  { id: 'publication', task: 'Which tables of the {db} database are published for logical replication, and under which publication?', answer: (db) => [v(db, 'PUB'), ...v(db, 'PUB_TABLES').split(', ')], tools: ['list_publication_tables'] }
]
type Task = { id: string; server: string; task: string; answer: string[]; tools: string[] }
const allTasks: Task[] = LOOKUPS.flatMap((lookup) => DATABASES.map((db) => ({ id: `${lookup.id}@${db.server}`, server: db.server, task: lookup.task.replace('{db}', db.said), answer: lookup.answer(db), tools: lookup.tools })))
const tasks = limit ? allTasks.slice(0, limit) : allTasks

const SYSTEM = [
  `You operate three PostgreSQL databases through three servers with the same tools: ${DATABASES.map((db) => `${db.server} is the ${db.said} database`).join(', ')}.`,
  'A tool named mcp__<server>__<tool> runs against that server\'s database. Do the whole task the user gives, then answer it.',
  'Do not ask for identifiers or confirmation. If a value is missing, look it up.'
].join(' ')

type Call = { server: string; tool: string; input: unknown; error?: true }
type Trial = { arm: string; model: string; sample: number; id: string; server: string; pass: boolean; finds: string[]; loaded: string[]; calls: Call[]; said: string; stop: string; requests: number; inputTokens: number; cacheRead: number; outputTokens: number; ms: number; error?: string }
const split = (name: string) => {
  const match = /^mcp__(.+?)__(.+)$/.exec(name)
  return match ? { server: match[1]!, tool: match[2]! } : undefined
}

const mean = (values: number[]) => (values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '')
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)] ?? ''
function summary(trials: Trial[]): void {
  const ok = trials.filter((trial) => !trial.error)
  const byId = new Map(allTasks.map((task) => [task.id, task]))
  const fitsOn = (trial: Trial, server: string) => trial.loaded.some((name) => { const parts = split(name); return parts?.server === server && byId.get(trial.id)!.tools.includes(parts.tool) })
  const cells = [...new Set(ok.map((trial) => `${trial.arm}\t${trial.model}`))]
  const rowsOf = (cell: string) => ok.filter((trial) => `${trial.arm}\t${trial.model}` === cell)
  console.log('\n| Arm | Model | Trials | Passed | Called a tool on the named server | Called a tool on another server | A fitting tool of the named server loaded | Tools of another server loaded | Searches or opens | Tools loaded | Requests | Median input tokens |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
  for (const cell of cells) {
    const rows = rowsOf(cell)
    console.log(
      `| ${cell.replace('\t', ' | ')} | ${rows.length} | ${rows.filter((t) => t.pass).length} | ${rows.filter((t) => t.calls.some((c) => c.server === t.server)).length} | ${rows.filter((t) => t.calls.some((c) => c.server !== t.server)).length} | ${rows.filter((t) => fitsOn(t, t.server)).length} | ${mean(rows.map((t) => new Set(t.loaded.filter((name) => split(name)?.server !== t.server)).size))} | ${mean(rows.map((t) => t.finds.length))} | ${mean(rows.map((t) => new Set(t.loaded).size))} | ${mean(rows.map((t) => t.requests))} | ${median(rows.map((t) => t.inputTokens))} |`
    )
  }
  console.log('\n| Task | Arm | Model | Passed | Searches or opens | Calls |')
  console.log('| :-- | :-- | :-- | :-- | :-- | :-- |')
  for (const trial of ok) console.log(`| ${trial.id} | ${trial.arm} | ${trial.model} #${trial.sample} | ${trial.pass ? 'yes' : 'no'} | ${trial.finds.join(' ; ')} | ${trial.calls.map((call) => `${call.server}/${call.tool}${call.error ? ' (error)' : ''}`).join(', ')} |`)
  const failed = trials.filter((trial) => trial.error)
  if (failed.length) console.log(`\n${failed.length} trials ended in an error: ${[...new Set(failed.map((trial) => trial.error!.slice(0, 120)))].join(' | ')}`)
}

const replayAt = args.indexOf('--replay')
if (replayAt >= 0) {
  const files = args.slice(replayAt + 1).filter((file) => !file.startsWith('--'))
  summary(files.flatMap((file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).slice(1).map((line) => JSON.parse(line) as Trial)))
} else {
  const psql = (database: string, sql: string, input?: string) => execFileSync('docker', ['exec', '-i', container, 'psql', '-q', '-U', 'postgres', '-d', database, '-At', ...(input === undefined ? ['-c', sql] : ['-f', '-'])], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  execFileSync('docker', ['start', container], { stdio: 'ignore' })
  for (let tries = 0; ; tries++) {
    try { psql('postgres', 'SELECT 1'); break } catch (error) { if (tries > 30) throw error; await new Promise((resolve) => setTimeout(resolve, 1000)) }
  }
  const template = readFileSync(new URL('../tasks/db/samename-seed.sql', import.meta.url), 'utf8')
  for (const db of DATABASES) {
    if (psql('postgres', `SELECT 1 FROM pg_database WHERE datname = '${db.database}'`) !== '1') psql('postgres', `CREATE DATABASE ${db.database}`)
    psql(db.database, '', template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => db.values[key]!))
  }
  process.stderr.write(`seeded ${DATABASES.map((db) => db.database).join(', ')}\n`)

  // One toolbox per database. Their logs go to the temp directory.
  mkdirSync('results/samename', { recursive: true })
  const children: ChildProcess[] = DATABASES.map((db) =>
    spawn(toolboxBin, ['--prebuilt=postgres', '--port', String(db.port)], {
      env: { ...process.env, POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: '55432', POSTGRES_DATABASE: db.database, POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: 'pd_local_only' },
      stdio: ['ignore', openSync(`${process.env.TEMP ?? '.'}/pd-${db.server}.log`, 'a'), openSync(`${process.env.TEMP ?? '.'}/pd-${db.server}.log`, 'a')]
    })
  )
  const stop = () => children.forEach((child) => child.kill())
  process.on('exit', stop)
  try {
    type Listed = { name: string; description?: string; inputSchema?: unknown }
    const Loose = z.looseObject({})
    const clients = new Map<string, Client>()
    const listed = new Map<string, Listed[]>()
    for (const db of DATABASES) {
      const url = new URL(`http://127.0.0.1:${db.port}/mcp`)
      let client: Client | undefined
      for (let tries = 0; !client; tries++) {
        try {
          const attempt = new Client({ name: 'groups-samename-run', version: '0.1.0' }, { capabilities: { extensions: { [TOOLBOX]: {} } }, versionNegotiation: { mode: 'auto' } })
          await attempt.connect(new StreamableHTTPClientTransport(url))
          client = attempt
        } catch (error) {
          if (tries > 30) throw error
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
      clients.set(db.server, client)
      listed.set(db.server, (await client.listTools()).tools.filter((tool) => !without.has(tool.name)))
    }
    const counts = DATABASES.map((db) => listed.get(db.server)!.length)
    process.stderr.write(`${counts.join(', ')} tools per server\n`)

    // The server checks an `Mcp-Name` header against `params.name`, and the client library sets none for a method it
    // does not know, so `groups/get` is posted directly.
    async function groupGet(db: Database, name: string): Promise<string[]> {
      const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'groups-samename-run', version: '0.1.0' }, 'io.modelcontextprotocol/clientCapabilities': { extensions: { [TOOLBOX]: {} } } }
      const response = await fetch(`http://127.0.0.1:${db.port}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'groups/get', 'mcp-name': name },
        body: JSON.stringify({ jsonrpc: '2.0', id: `get-${name}`, method: 'groups/get', params: { name, _meta: meta } })
      })
      const text = await response.text()
      const json = JSON.parse(text.startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data:'))!.slice(5)) as { result?: { tools?: { name: string }[] }; error?: { message: string } }
      if (json.error) throw new Error(json.error.message)
      return (json.result?.tools ?? []).map((tool) => tool.name)
    }
    type Group = { server: string; name: string; tools: string[] }
    const groups: Group[] = []
    if (arm === 'groups') {
      for (const db of DATABASES) {
        const names = new Set(listed.get(db.server)!.map((tool) => tool.name))
        const body = (await clients.get(db.server)!.request({ method: 'groups/list', params: {} }, Loose)) as unknown as { groups: { name: string }[] }
        for (const group of body.groups) groups.push({ server: db.server, name: group.name, tools: (await groupGet(db, group.name)).filter((name) => names.has(name)).map((name) => `mcp__${db.server}__${name}`) })
      }
    }
    const system =
      arm === 'search'
        ? SYSTEM
        : `${SYSTEM}\n\nThe tools are in groups. Call open_group with a server and a group's name to load its tools, then call them.\n${DATABASES.map((db) => `\nGroups of server ${db.server}:\n${groups.filter((group) => group.server === db.server).map((group) => `- ${group.name}`).join('\n')}`).join('\n')}`
    const first: Anthropic.ToolUnion =
      arm === 'search'
        ? { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' }
        : { name: 'open_group', description: "Load a group's tools by its server and the group's name, so they can be called.", input_schema: { type: 'object', properties: { server: { type: 'string', enum: DATABASES.map((db) => db.server) }, name: { type: 'string' } }, required: ['server', 'name'] } }
    const tools: Anthropic.ToolUnion[] = [first, ...DATABASES.flatMap((db) => listed.get(db.server)!.map((tool) => ({ name: `mcp__${db.server}__${tool.name}`, description: tool.description ?? '', input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true })))]
    if (args.includes('--dry')) {
      console.log(`${tools.length - 1} tools, ${groups.length} groups. First task: ${tasks[0]!.task} Answer: ${tasks[0]!.answer.join(', ')}`)
      for (const db of DATABASES) console.log(db.server, psql(db.database, "SELECT string_agg(indexrelid::regclass::text, ',') FROM pg_index WHERE NOT indisvalid"), psql(db.database, "SELECT last_value FROM orders_id_seq"))
      for (const group of groups.slice(0, 6)) console.log(`${group.server}/${group.name}: ${group.tools.join(', ')}`)
      process.exit(0)
    }
    const anthropic = new Anthropic({ maxRetries: 4 })

    async function run(model: string, sample: number, task: Task): Promise<Trial> {
      const trial: Trial = { arm, model, sample, id: task.id, server: task.server, pass: false, finds: [], loaded: [], calls: [], said: '', stop: '', requests: 0, inputTokens: 0, cacheRead: 0, outputTokens: 0, ms: 0 }
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
            if (block.type === 'server_tool_use') trial.finds.push(JSON.stringify(block.input))
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
            } else if (block.type === 'tool_use' && split(block.name) && clients.has(split(block.name)!.server)) {
              const { server, tool } = split(block.name)!
              let text: string
              let failed = false
              try {
                const result = (await clients.get(server)!.callTool({ name: tool, arguments: block.input ?? {} })) as { content?: { type: string; text?: string }[]; isError?: boolean }
                text = (result.content ?? []).map((part) => part.text ?? '').join('\n') || '(no rows)'
                failed = result.isError === true
              } catch (error) {
                text = String(error)
                failed = true
              }
              trial.calls.push({ server, tool, input: block.input, ...(failed ? { error: true as const } : {}) })
              results.push({ type: 'tool_result', tool_use_id: block.id, content: text.length > 20000 ? `${text.slice(0, 20000)}\n(cut at 20,000 characters)` : text, ...(failed ? { is_error: true } : {}) })
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
      trial.pass = trial.calls.some((call) => call.server === task.server) && task.answer.every((pattern) => new RegExp(pattern, 'i').test(trial.said))
      trial.said = trial.said.replace(/\s+/g, ' ').slice(-1200)
      return trial
    }

    const out = `results/samename/${new Date().toISOString().slice(0, 10)}-samename-${label}.jsonl`
    writeFileSync(out, JSON.stringify({ arm, servers: DATABASES.map(({ server, database }) => ({ server, database })), toolbox: clients.get(DATABASES[0]!.server)!.getServerVersion(), tools: tools.length - 1, without: [...without], groups: groups.length || undefined, tasks: tasks.length, samples, models, maxRequests, effort: 'low', system }) + '\n')
    const trials: Trial[] = []
    for (const model of models) {
      for (const task of tasks) {
        for (let sample = 1; sample <= samples; sample++) {
          const trial = await run(model, sample, task)
          trials.push(trial)
          appendFileSync(out, JSON.stringify(trial) + '\n')
          process.stderr.write(`${model} #${sample} ${task.id}: ${trial.error ?? (trial.pass ? 'pass' : 'fail')}, ${trial.calls.map((call) => `${call.server}/${call.tool}`).join(' ')}\n`)
        }
      }
    }
    for (const client of clients.values()) await client.close()
    summary(trials)
    process.stderr.write(`rows in ${out}\n`)
  } finally {
    stop()
  }
}
