// Runs the trace tasks through headless Claude Code sessions, one per task, under one condition, and keeps
// each session's JSONL next to an index row. Score with trace-score.ts.
//
// Usage: tsx scripts/trace-run.ts --condition groups|flat-all-schemas|flat-toolsearch [--models a,b] [--tasks id,id] [--limit N] [--label name] [--max-turns 12] [--budget 2]
//
// Conditions:
//   groups           the mod against the opt2 Worker (groups and skills), no MCP server connected
//   flat-all-schemas    the flat Worker as an MCP server with ENABLE_TOOL_SEARCH=false, all 238 schemas in the prompt; the mod against the
//                    same Worker for the skill index and read_skill
//   flat-toolsearch  the flat Worker as an MCP server with the host's tool search left on; the mod for skills as above
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { PREAMBLE, TRACE_TASKS } from './trace-tasks.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
type Condition = 'groups' | 'flat-all-schemas' | 'flat-toolsearch'
const condition = opt('condition', 'groups') as Condition
const models = opt('models', 'claude-sonnet-5-5')!.split(',')
const only = opt('tasks')?.split(',')
const limit = Number(opt('limit', '0'))
const label = opt('label', 'traces')!
const maxTurns = opt('max-turns', '12')!
// Loading every schema up front is a 300k-token prefix on each turn, so that condition gets a higher default budget.
const budget = opt('budget', condition === 'flat-all-schemas' ? '6' : '2')!
// With --retry-errors, a run whose index row says it errored is run again and its row replaced.
const retryErrors = args.includes('--retry-errors')
const OPT2 = opt('groups-url', 'https://pd-groups-opt2.olahungerford.workers.dev/mcp')!
const FLAT = opt('flat-url', 'https://pd-groups-flat.olahungerford.workers.dev/mcp')!

const cwd = process.cwd()
const repoSlug = cwd.replace(/[^A-Za-z0-9]/g, '-')
const sessionsDir = join(homedir(), '.claude', 'projects', repoSlug)
const outDir = resolve('results', 'traces', label, condition)
const index = resolve('results', 'traces', label, 'index.jsonl')
mkdirSync(outDir, { recursive: true })

const BUILTIN_OFF = ['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'TodoWrite', 'Skill', 'Workflow']
// The claude binary by path, so the JSON arguments reach it unquoted by any shell. CLAUDE_BIN overrides.
const CLAUDE = process.env.CLAUDE_BIN ?? [join(homedir(), '.local', 'bin', 'claude.exe'), join(homedir(), '.local', 'bin', 'claude')].find((p) => existsSync(p)) ?? 'claude'

/**
 * The mod folder for a condition. `--settings pluginConfigs` did not reach a `--plugin-dir` mod's options in a
 * headless run (observed 2026-11-08: the mod kept its default URL), so the flat conditions get a copy of the mod
 * whose manifest default is the flat Worker. Same plugin name, so the tools are still `mcp__groups__*`.
 */
function modDir(): string {
  const source = resolve('mods', 'groups')
  if (condition === 'groups') return source
  const copy = resolve('mods', '.groups-flat')
  mkdirSync(join(copy, '.claude-plugin'), { recursive: true })
  mkdirSync(join(copy, 'hooks'), { recursive: true })
  const manifest = JSON.parse(readFileSync(join(source, '.claude-plugin', 'plugin.json'), 'utf8')) as { userConfig: { url: { default: string } } }
  manifest.userConfig.url.default = FLAT
  writeFileSync(join(copy, '.claude-plugin', 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n')
  copyFileSync(join(source, 'hooks', 'hooks.json'), join(copy, 'hooks', 'hooks.json'))
  writeFileSync(join(copy, 'hooks', 'register.ts'), readFileSync(join(source, 'hooks', 'register.ts'), 'utf8').replace(OPT2, FLAT))
  return copy
}

function claudeArgs(model: string, task: string): { argv: string[]; env: NodeJS.ProcessEnv } {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' }
  const argv = [
    '-p', task,
    '--output-format', 'json',
    '--model', model,
    '--max-turns', maxTurns,
    '--max-budget-usd', budget,
    '--append-system-prompt', PREAMBLE,
    '--disallowedTools', ...BUILTIN_OFF,
    '--plugin-dir', modDir(),
    '--strict-mcp-config'
  ]
  if (condition === 'groups') {
    argv.push('--mcp-config', JSON.stringify({ mcpServers: {} }), '--allowedTools', 'mcp__groups__*')
  } else {
    argv.push('--mcp-config', JSON.stringify({ mcpServers: { cf: { type: 'http', url: FLAT } } }), '--allowedTools', 'mcp__groups__*', 'mcp__cf__*')
    if (condition === 'flat-all-schemas') env.ENABLE_TOOL_SEARCH = 'false'
  }
  return { argv, env }
}

type Result = { session_id?: string; num_turns?: number; duration_ms?: number; duration_api_ms?: number; total_cost_usd?: number; usage?: Record<string, unknown>; result?: string; is_error?: boolean; subtype?: string }

const tasks = (only ? TRACE_TASKS.filter((t) => only.includes(t.id)) : TRACE_TASKS).slice(0, limit > 0 ? limit : undefined)
const modelShort = (m: string) => m.replace(/^claude-/, '')
console.error(`${condition}: ${tasks.length} tasks x ${models.length} models -> ${outDir}`)

type IndexRow = { condition: string; model: string; taskId: string; isError?: boolean }
const indexRows = (): IndexRow[] => (existsSync(index) ? readFileSync(index, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as IndexRow) : [])
function dropIndexRow(model: string, taskId: string): void {
  const kept = indexRows().filter((r) => !(r.condition === condition && r.model === model && r.taskId === taskId))
  writeFileSync(index, kept.map((r) => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''))
}

for (const model of models) {
  for (const task of tasks) {
    const file = join(outDir, `${modelShort(model)}--${task.id}.jsonl`)
    const previous = indexRows().find((r) => r.condition === condition && r.model === model && r.taskId === task.id)
    if (existsSync(file) && !(retryErrors && previous?.isError)) {
      console.error(`skip ${modelShort(model)} ${task.id}: ${file} exists`)
      continue
    }
    if (previous) dropIndexRow(model, task.id)
    const { argv, env } = claudeArgs(model, task.task)
    const started = Date.now()
    const run = spawnSync(CLAUDE, argv, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const wall = Date.now() - started
    let result: Result = {}
    try {
      result = JSON.parse(run.stdout.trim().split('\n').filter((l) => l.startsWith('{')).at(-1) ?? '{}') as Result
    } catch {
      result = { is_error: true, result: `unparsed stdout: ${run.stdout.slice(0, 300)}` }
    }
    const session = result.session_id
    const source = session ? join(sessionsDir, `${session}.jsonl`) : undefined
    const copied = source && existsSync(source) ? (copyFileSync(source, file), true) : false
    const row = {
      label, condition, model, taskId: task.id, sessionId: session, file: copied ? file : undefined,
      numTurns: result.num_turns, durationMs: result.duration_ms, apiMs: result.duration_api_ms, wallMs: wall, costUsd: result.total_cost_usd,
      usage: result.usage, isError: result.is_error ?? run.status !== 0, subtype: result.subtype, exit: run.status,
      answer: result.result, stderr: run.stderr?.slice(0, 500) || undefined
    }
    appendFileSync(index, JSON.stringify(row) + '\n')
    console.error(`${modelShort(model)} ${task.id}: ${row.isError ? 'ERROR' : 'ok'} turns=${row.numTurns} ${Math.round(wall / 1000)}s $${(row.costUsd ?? 0).toFixed(3)} ${copied ? '' : '(no session file)'}`)
  }
}
console.error(`index: ${index} (${readFileSync(index, 'utf8').split('\n').filter(Boolean).length} rows)`)
