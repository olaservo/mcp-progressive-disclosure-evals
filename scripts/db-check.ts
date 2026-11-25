// Checks the database tasks' check queries with no model: each must be false on the seeded database and true after
// scripts/db/fixes.sql. Leaves the database seeded.
// Usage: tsx scripts/db-check.ts [--container pd-toolbox-pg]
import { readFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'

const args = process.argv.slice(2)
const container = args.includes('--container') ? args[args.indexOf('--container') + 1]! : 'pd-toolbox-pg'
const tasks = JSON.parse(readFileSync(new URL('./db-tasks.json', import.meta.url), 'utf8')) as { id: string; check: string }[]
const psql = (sql: string, input?: string) => execFileSync('docker', ['exec', '-i', container, 'psql', '-q', '-U', 'postgres', '-d', 'shop', '-At', ...(input === undefined ? ['-c', sql] : ['-f', '-'])], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const seed = readFileSync(new URL('./db/seed.sql', import.meta.url), 'utf8')

psql('', seed)
spawn('docker', ['exec', container, 'psql', '-q', 'dbname=shop user=postgres application_name=pd-blocker', '-c', "UPDATE products SET price = price WHERE sku = 'SKU-0001'; SELECT pg_sleep(86400)"], { stdio: 'ignore', detached: true }).unref()
await pause(2500)
const before = tasks.map((task) => psql(task.check))
psql('', readFileSync(new URL('./db/fixes.sql', import.meta.url), 'utf8'))
await pause(2500)
const after = tasks.map((task) => psql(task.check))
let bad = 0
for (const [at, task] of tasks.entries()) {
  const ok = before[at] !== 't' && after[at] === 't'
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'BAD '} ${task.id}: before ${before[at] || 'null'}, after ${after[at] || 'null'}`)
}
psql('', seed)
if (bad) process.exit(1)
