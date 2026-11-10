// Re-scores the v3 flat runs with a first-call rule decided after the results (2026-11-10). The flat prompt asks for the
// tool a model would call first, and the committed answers list only the tools that do the job, so a lookup first
// (zones_list for a task that names a domain, d1_list before a query) scored as a miss. This rule also accepts
// (a) any tool of the same product as a needed tool, as v2's product prefixes did, and
// (b) zones_list or zones_get when a needed tool's path takes {zone_id}, read from the catalog.
// The committed scoring and --replay are unchanged; this prints both.
// Usage: tsx scripts/v3-rescore.ts   (after npm run vendor, which fetches cloudflare/mcp into .upstream/)
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const forge = join(root, '.upstream', 'cloudflare-mcp', 'src', 'generated', 'forge-mcp')

// Tool name -> HTTP path, from each generated tools.ts (the description ends with "METHOD /path").
const paths = new Map<string, string>()
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (entry.name === 'tools.ts') {
      for (const match of readFileSync(full, 'utf8').matchAll(/name: "([^"]+)",[\s\S]*?description: "(?:[^"\\]|\\.)*?\\n\\n[A-Z]+ ([^"]+)"/g)) paths.set(match[1]!, match[2]!)
    }
  }
}
walk(forge)

type V3 = { id: string; task: string; tools: string[] }
const tasks = JSON.parse(readFileSync(join(root, 'scripts', 'select-v3.json'), 'utf8')) as V3[]
const product = (name: string) => name.split('_')[0]!
const lenient = new Map<string, (name: string) => boolean>()
for (const task of tasks) {
  const needed = [...paths.keys()].filter((name) => task.tools.some((prefix) => name.startsWith(prefix)))
  const products = new Set(task.tools.map(product))
  const zoned = needed.some((name) => paths.get(name)!.includes('{zone_id}'))
  lenient.set(task.task, (name) => products.has(product(name)) || (zoned && (name === 'zones_list' || name === 'zones_get')))
}

const files = readdirSync(join(root, 'results')).filter((f) => /^\d{4}-\d{2}-\d{2}-select3-full-flat.*\.jsonl$/.test(f)).sort()
console.log('| Model | Committed (strict) | First-call rule |\n| :-- | --: | --: |')
for (const file of files) {
  const lines = readFileSync(join(root, 'results', file), 'utf8').split('\n').filter(Boolean)
  const byModel = new Map<string, { strict: number; lenient: number; n: number }>()
  for (const line of lines.slice(1)) {
    const trial = JSON.parse(line) as { model: string; task: string; pick?: string; correct: boolean }
    const row = byModel.get(trial.model) ?? { strict: 0, lenient: 0, n: 0 }
    const name = (trial.pick ?? '').replace(/^tool:/, '')
    row.n++
    if (trial.correct) row.strict++
    if (trial.correct || (trial.pick?.startsWith('tool:') && lenient.get(trial.task)!(name))) row.lenient++
    byModel.set(trial.model, row)
  }
  for (const [model, row] of byModel) console.log(`| ${model} | ${row.strict}/${row.n} | ${row.lenient}/${row.n} |`)
}
const zonedIds = tasks.filter((t) => [...paths.keys()].some((name) => t.tools.some((p) => name.startsWith(p)) && paths.get(name)!.includes('{zone_id}'))).map((t) => t.id)
console.log(`\nTasks where zones_list or zones_get counts: ${zonedIds.join(', ')}`)
