// Checks the lookup tasks (scripts/db-find-tasks.json) with no model: on the seeded database, calls each tool a task
// lists and reports whether its output holds the task's answer. A task is good when at least one tool does.
// Usage: tsx scripts/db-find-check.ts [--toolbox http://127.0.0.1:5055/mcp] [--container pd-toolbox-pg] [--show]
import { readFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const opt = (name: string, fallback: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1]! : fallback)
const container = opt('container', 'pd-toolbox-pg')
type Task = { id: string; setup?: 'blocker'; answer?: string[]; answerQuery?: string; tools: { name: string; arguments?: Record<string, unknown> }[] }
const tasks = JSON.parse(readFileSync(new URL('./db-find-tasks.json', import.meta.url), 'utf8')) as Task[]
const psql = (sql: string, input?: string) => execFileSync('docker', ['exec', '-i', container, 'psql', '-q', '-U', 'postgres', '-d', 'shop', '-At', ...(input === undefined ? ['-c', sql] : ['-f', '-'])], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()

psql('', readFileSync(new URL('./db/seed.sql', import.meta.url), 'utf8'))
spawn('docker', ['exec', container, 'psql', '-q', 'dbname=shop user=postgres application_name=pd-blocker', '-c', "UPDATE products SET price = price WHERE sku = 'SKU-0001'; SELECT pg_sleep(86400)"], { stdio: 'ignore', detached: true }).unref()
await new Promise((resolve) => setTimeout(resolve, 2500))
const toolbox = new Client({ name: 'groups-db-find-check', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await toolbox.connect(new StreamableHTTPClientTransport(new URL(opt('toolbox', 'http://127.0.0.1:5055/mcp'))))
let bad = 0
for (const task of tasks) {
  const wanted = task.answerQuery ? [`\\b${psql(task.answerQuery)}\\b`] : task.answer!
  const holds: string[] = []
  for (const tool of task.tools) {
    const result = (await toolbox.callTool({ name: tool.name, arguments: tool.arguments ?? {} })) as { content?: { text?: string }[]; isError?: boolean }
    const text = (result.content ?? []).map((part) => part.text ?? '').join('\n')
    const found = !result.isError && wanted.every((pattern) => new RegExp(pattern, 'i').test(text))
    holds.push(`${tool.name}${tool.arguments ? JSON.stringify(tool.arguments) : ''} ${result.isError ? 'error' : found ? 'yes' : 'no'}`)
    if (args.includes('--show')) console.log(`--- ${task.id} ${tool.name}\n${text.slice(0, 1500)}`)
  }
  const ok = holds.some((line) => line.endsWith(' yes'))
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'BAD '} ${task.id}: ${holds.join(', ')}`)
}
await toolbox.close()
psql('', readFileSync(new URL('./db/seed.sql', import.meta.url), 'utf8'))
if (bad) process.exit(1)
