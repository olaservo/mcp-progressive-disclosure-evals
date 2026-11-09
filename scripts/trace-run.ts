// Runs the trace tasks through headless Claude Code sessions, one per task, under one condition, and keeps
// each session's JSONL next to an index row. Score with trace-score.ts.
//
// Usage: tsx scripts/trace-run.ts --condition <condition> [--models a,b] [--tasks id,id] [--limit N] [--label name] [--max-turns 12] [--budget 2]
//
// Conditions:
//   groups-rec           the mod against the opt2-rec Worker, scoped tools deferred behind the host's tool search, grouped skills listed once
//   groups-rec-resident  the same with ENABLE_TOOL_SEARCH=false and scoped tools registered resident, as a client without tool search would
//   groups               the mod against the opt2 Worker (the as-generated server), scoped tools deferred, every skill listed
//   flat-all-schemas     the flat Worker as an MCP server with ENABLE_TOOL_SEARCH=false, all 238 schemas in the prompt; the mod against the
//                        same Worker for the skill index and read_skill
//   flat-toolsearch      the flat Worker as an MCP server with the host's tool search left on; the mod for skills as above
//
// Each session writes its group opens to <session>.groups.jsonl through the mod's GROUPS_LOG.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, appendFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { PREAMBLE, TRACE_TASKS } from './trace-tasks.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const CONDITIONS = ['groups-rec', 'groups-rec-resident', 'groups', 'flat-all-schemas', 'flat-toolsearch'] as const
type Condition = (typeof CONDITIONS)[number]
const condition = opt('condition', 'groups-rec') as Condition
if (!CONDITIONS.includes(condition)) throw new Error(`Unknown condition ${condition}; one of ${CONDITIONS.join(', ')}`)
const isGroups = condition.startsWith('groups')
const toolSearchOff = condition === 'flat-all-schemas' || condition === 'groups-rec-resident'
const models = opt('models', 'claude-sonnet-5-5')!.split(',')
const only = opt('tasks')?.split(',')
const limit = Number(opt('limit', '0'))
const label = opt('label', 'traces')!
const maxTurns = opt('max-turns', '12')!
// Loading every schema up front is a 300k-token prefix on each turn, and a resident open rewrites the prefix, so those get a higher default budget.
const budget = opt('budget', toolSearchOff ? '6' : '2')!
// With --retry-errors, a run whose index row says it errored is run again and its row replaced.
const retryErrors = args.includes('--retry-errors')
const OPT2 = opt('groups-url', 'https://pd-groups-opt2.olahungerford.workers.dev/mcp')!
const OPT2_REC = opt('rec-url', 'https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')!
/** The literal the mod's source defaults to, replaced in each copy. */
const MOD_DEFAULT_URL = 'https://pd-groups-opt2.olahungerford.workers.dev/mcp'
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
 * headless run (observed 2026-11-08: the mod kept its default URL), so each condition gets a gitignored copy of
 * the mod with its URL and option expressions rewritten. Same plugin name, so the tools are still `mcp__groups__*`.
 */
function modDir(): string {
  const source = resolve('mods', 'groups')
  // One copy per condition and model list, so jobs run side by side never rewrite a copy another session is loading.
  const copy = resolve('mods', `.groups-${condition}--${models.map((m) => m.replace(/^claude-/, '')).join('+')}`)
  const url = condition === 'groups' ? OPT2 : condition.startsWith('groups-rec') ? OPT2_REC : FLAT
  mkdirSync(join(copy, '.claude-plugin'), { recursive: true })
  mkdirSync(join(copy, 'hooks'), { recursive: true })
  const manifest = JSON.parse(readFileSync(join(source, '.claude-plugin', 'plugin.json'), 'utf8')) as { userConfig: Record<string, { default: unknown }> }
  manifest.userConfig.url!.default = url
  manifest.userConfig.deferScoped!.default = condition !== 'groups-rec-resident'
  manifest.userConfig.dedupGroupedSkills!.default = condition !== 'groups'
  writeFileSync(join(copy, '.claude-plugin', 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n')
  copyFileSync(join(source, 'hooks', 'hooks.json'), join(copy, 'hooks', 'hooks.json'))
  const swap = (text: string, from: string, to: string) => {
    if (!text.includes(from)) throw new Error(`mod source no longer contains: ${from}`)
    return text.replace(from, to)
  }
  let code = readFileSync(join(source, 'hooks', 'register.ts'), 'utf8')
  code = swap(code, MOD_DEFAULT_URL, url)
  code = swap(code, 'deferScoped = options.deferScoped !== false', `deferScoped = ${condition !== 'groups-rec-resident'}`)
  code = swap(code, 'dedupGroupedSkills = options.dedupGroupedSkills !== false', `dedupGroupedSkills = ${condition !== 'groups'}`)
  writeFileSync(join(copy, 'hooks', 'register.ts'), code)
  return copy
}
const MOD = modDir()
const MOD_VERSION = (JSON.parse(readFileSync(join(MOD, '.claude-plugin', 'plugin.json'), 'utf8')) as { version: string }).version

function claudeArgs(model: string, task: string, groupsLog: string): { argv: string[]; env: NodeJS.ProcessEnv } {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1', GROUPS_LOG: groupsLog }
  if (toolSearchOff) env.ENABLE_TOOL_SEARCH = 'false'
  const argv = [
    '-p', task,
    '--output-format', 'json',
    '--model', model,
    '--max-turns', maxTurns,
    '--max-budget-usd', budget,
    '--append-system-prompt', PREAMBLE,
    '--disallowedTools', ...BUILTIN_OFF,
    '--plugin-dir', MOD,
    '--strict-mcp-config'
  ]
  if (isGroups) {
    argv.push('--mcp-config', JSON.stringify({ mcpServers: {} }), '--allowedTools', 'mcp__groups__*')
  } else {
    argv.push('--mcp-config', JSON.stringify({ mcpServers: { cf: { type: 'http', url: FLAT } } }), '--allowedTools', 'mcp__groups__*', 'mcp__cf__*')
  }
  return { argv, env }
}

type Result = { session_id?: string; num_turns?: number; duration_ms?: number; duration_api_ms?: number; total_cost_usd?: number; usage?: Record<string, unknown>; result?: string; is_error?: boolean; subtype?: string }

const tasks = (only ? TRACE_TASKS.filter((t) => only.includes(t.id)) : TRACE_TASKS).slice(0, limit > 0 ? limit : undefined)
const modelShort = (m: string) => m.replace(/^claude-/, '')
console.error(`${condition}: ${tasks.length} tasks x ${models.length} models -> ${outDir} (mod copy ${MOD})`)

type IndexRow = { condition: string; model: string; taskId: string; isError?: boolean }
// Several conditions may run at once and append to the same index, so a line being written is skipped, not parsed.
const indexRows = (): IndexRow[] =>
  existsSync(index)
    ? readFileSync(index, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as IndexRow] } catch { return [] } })
    : []
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
    const groupsLog = file.replace(/\.jsonl$/, '.groups.jsonl')
    if (existsSync(groupsLog)) rmSync(groupsLog)
    const { argv, env } = claudeArgs(model, task.task, groupsLog)
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
      label, condition, modVersion: MOD_VERSION, model, taskId: task.id, sessionId: session, file: copied ? file : undefined, groupsLog: existsSync(groupsLog) ? groupsLog : undefined,
      numTurns: result.num_turns, durationMs: result.duration_ms, apiMs: result.duration_api_ms, wallMs: wall, costUsd: result.total_cost_usd,
      usage: result.usage, isError: result.is_error ?? run.status !== 0, subtype: result.subtype, exit: run.status,
      answer: result.result, stderr: run.stderr?.slice(0, 500) || undefined
    }
    appendFileSync(index, JSON.stringify(row) + '\n')
    console.error(`${modelShort(model)} ${task.id}: ${row.isError ? 'ERROR' : 'ok'} turns=${row.numTurns} ${Math.round(wall / 1000)}s $${(row.costUsd ?? 0).toFixed(3)} ${copied ? '' : '(no session file)'}`)
  }
}
console.error(`index: ${index} (${readFileSync(index, 'utf8').split('\n').filter(Boolean).length} rows)`)
