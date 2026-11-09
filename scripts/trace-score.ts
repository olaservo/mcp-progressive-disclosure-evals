// Scores trace runs from their index rows and session files. Usage: tsx scripts/trace-score.ts [--label traces]
import { readFileSync, existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { TRACE_TASKS, type Call, type Picks } from './trace-tasks.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const label = opt('label', 'traces')!
const index = resolve('results', 'traces', label, 'index.jsonl')

type Row = { condition: string; model: string; taskId: string; modVersion?: string; sessionId?: string; file?: string; groupsLog?: string; numTurns?: number; durationMs?: number; costUsd?: number; isError?: boolean; answer?: string }
type Usage = { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number }
type Block = { type: string; name?: string; id?: string; input?: Record<string, unknown>; tool_use_id?: string; content?: unknown; is_error?: boolean }
type Line = { type: string; timestamp?: string; message?: { id?: string; role?: string; content?: Block[] | string; usage?: Usage } }

const PREFIXES = ['mcp__groups__', 'mcp__cf__']
const strip = (name: string) => PREFIXES.reduce((n, p) => (n.startsWith(p) ? n.slice(p.length) : n), name)
/** `skill://x/SKILL.md`, `x/SKILL.md` and `x` score as `x`; a file of the skill stays `x/<path>`. */
const skillName = (raw: string) => raw.trim().replace(/^skill:\/\//, '').replace(/^\/+|\/+$/g, '').replace(/\/SKILL\.md$/, '')
/** The tasks whose workflow has a skill and a group of the same name. */
const WORKFLOW_SKILLS = ['turnstile-spin', 'durable-objects', 'cloudflare-email-service']
const isWorkflowTask = (taskId: string) => TRACE_TASKS.find((t) => t.id === taskId)!.firstPick.some((p) => WORKFLOW_SKILLS.includes(p))

function readSession(file: string, groupLoadsSkill: boolean): { picks: Picks; turns: number; usage: Required<Usage>; toolSearch: number; firstStep?: string; turnLatencies: number[] } {
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as Line } catch { return undefined } }).filter((l): l is Line => !!l)
  const picks: Picks = { groups: [], skills: [], tools: [], groupLoadsSkill }
  const usage = { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 }
  let turns = 0
  let toolSearch = 0
  let firstStep: string | undefined
  const errors = new Set<string>()
  for (const line of lines) {
    if (line.type === 'user' && Array.isArray(line.message?.content)) {
      for (const b of line.message.content) if (b.type === 'tool_result' && b.is_error && b.tool_use_id) errors.add(b.tool_use_id)
    }
  }
  // One API response is written as one line per content block, each carrying the same id and usage.
  // A turn's latency runs from the last user row before it (the prompt or a tool result) to its first line.
  const seen = new Set<string>()
  const turnLatencies: number[] = []
  let lastUser: number | undefined
  for (const line of lines) {
    const at = line.timestamp ? Date.parse(line.timestamp) : undefined
    if (line.type === 'user') { if (at !== undefined) lastUser = at; continue }
    if (line.type !== 'assistant' || !line.message) continue
    const id = line.message.id ?? `line-${turns}-${Math.random()}`
    if (!seen.has(id)) {
      seen.add(id)
      turns++
      if (at !== undefined && lastUser !== undefined) turnLatencies.push(at - lastUser)
      const u = line.message.usage ?? {}
      usage.input_tokens += u.input_tokens ?? 0
      usage.cache_creation_input_tokens += u.cache_creation_input_tokens ?? 0
      usage.cache_read_input_tokens += u.cache_read_input_tokens ?? 0
      usage.output_tokens += u.output_tokens ?? 0
    }
    if (!Array.isArray(line.message.content)) continue
    for (const b of line.message.content) {
      if (b.type !== 'tool_use' || !b.name) continue
      const name = strip(b.name)
      const input = b.input ?? {}
      if (b.name === 'ToolSearch') { toolSearch++; continue }
      if (name === 'open_group') { const g = String(input.name ?? ''); picks.groups.push(g); firstStep ??= g; continue }
      if (name === 'read_skill') { const s = skillName(String(input.name ?? '')); picks.skills.push(s); firstStep ??= `skill:${s}`; continue }
      if (name === 'list_groups') continue
      const call: Call = { name, args: input, isError: !!b.id && errors.has(b.id) }
      picks.tools.push(call)
      firstStep ??= name
    }
  }
  return { picks, turns, usage, toolSearch, firstStep, turnLatencies }
}

/** Groups the server sent: one row per open in the mod's GROUPS_LOG, including opens read_skill made. Absent for round one. */
function groupOpens(file: string | undefined): number | undefined {
  if (!file || !existsSync(file)) return undefined
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).length
}

function firstPickOk(task: (typeof TRACE_TASKS)[number], firstStep: string | undefined, picks: Picks): boolean {
  if (firstStep === undefined) return task.firstPick.includes('none')
  return task.firstPick.some((p) => (p === 'none' ? false : p.startsWith('skill:') ? firstStep === p || (picks.groups[0] === p.slice(6)) : firstStep === p || firstStep.startsWith(p)))
}

// The redacted copy's index carries paths relative to its own folder, so it scores the same way.
const base = resolve('results', 'traces', label)
const absolute = (p?: string) => (p && !isAbsolute(p) ? join(base, p) : p)
const rows = readFileSync(index, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row).map((r) => ({ ...r, file: absolute(r.file), groupsLog: absolute(r.groupsLog) }))
type Scored = Row & { done: boolean; first: boolean; workflow: boolean; turns: number; tokensIn: number; cacheRead: number; cacheWrite: number; out: number; toolSearch: number; opens: number; skillReads: number; turnLatencies: number[]; firstStep?: string; calls: string[] }
const scored: Scored[] = rows.map((row) => {
  const task = TRACE_TASKS.find((t) => t.id === row.taskId)!
  const workflow = isWorkflowTask(row.taskId)
  if (!row.file || !existsSync(row.file)) return { ...row, done: false, first: false, workflow, turns: 0, tokensIn: 0, cacheRead: 0, cacheWrite: 0, out: 0, toolSearch: 0, opens: 0, skillReads: 0, turnLatencies: [], calls: [] }
  // Index rows without a mod version come from round one, whose open_group inlined the SKILL.md.
  const s = readSession(row.file, row.modVersion === undefined)
  return {
    ...row,
    done: !row.isError && task.done(s.picks, row.answer ?? ''),
    first: firstPickOk(task, s.firstStep, s.picks),
    workflow,
    turns: s.turns,
    tokensIn: s.usage.input_tokens + s.usage.cache_creation_input_tokens + s.usage.cache_read_input_tokens,
    cacheRead: s.usage.cache_read_input_tokens,
    cacheWrite: s.usage.cache_creation_input_tokens,
    out: s.usage.output_tokens,
    toolSearch: s.toolSearch,
    opens: groupOpens(row.groupsLog) ?? s.picks.groups.length,
    skillReads: s.picks.skills.length,
    turnLatencies: s.turnLatencies,
    firstStep: s.firstStep,
    calls: [...s.picks.groups.map((g) => `open:${g}`), ...s.picks.skills.map((k) => `skill:${k}`), ...s.picks.tools.map((c) => `${c.name}${c.isError ? '!' : ''}`)]
  }
})

const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 1e-9))]! : 0 }
const median = (xs: number[]) => quantile(xs, 0.5)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const secs = (ms: number) => (ms / 1000).toFixed(1)
const groupsOf = <T, K extends string>(xs: T[], key: (x: T) => K) => { const m = new Map<K, T[]>(); for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]); return m }
// Rows in a fixed order: conditions as trace-run.ts lists them, then models by size.
const CONDITION_ORDER = ['groups-rec', 'groups-rec-resident', 'groups', 'flat-toolsearch', 'flat-all-schemas']
const MODEL_ORDER = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']
const rank = (list: string[], value: string) => (list.includes(value) ? list.indexOf(value) : list.length)
const byCondition = new Map(
  [...groupsOf(scored, (s) => `${s.condition}|${s.model}`)].sort(([a], [b]) => {
    const [ca, ma] = a.split('|') as [string, string]
    const [cb, mb] = b.split('|') as [string, string]
    return rank(CONDITION_ORDER, ca) - rank(CONDITION_ORDER, cb) || rank(MODEL_ORDER, ma) - rank(MODEL_ORDER, mb)
  })
)

console.log(`Trace runs: ${label}, ${scored.length} sessions. "Done" is the task's completion rubric over the calls the session made; "First step" is whether the first group opened, skill read or tool called fits the task, as in the selection trial. Wall is the session's duration_ms; turn latency runs from the last user row (prompt or tool result) to the next assistant row. Group opens count every groups/get the mod made, including those read_skill made, where the session has a GROUPS_LOG; otherwise open_group calls.\n`)
console.log('| Condition | Model | Done | First step | Errors | Median turns | p50 wall s | p90 wall s | p50 turn latency s | Total cost USD | Input tokens (incl. cache) | Cache read share | Cache write tokens | Output tokens | ToolSearch calls | Group opens per session | read_skill calls |')
console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
for (const [key, mine] of byCondition) {
  const [condition, model] = key.split('|')
  const tokens = mine.reduce((a, s) => a + s.tokensIn, 0)
  const cache = mine.reduce((a, s) => a + s.cacheRead, 0)
  const walls = mine.map((s) => s.durationMs ?? 0)
  console.log(`| ${condition} | ${model} | ${mine.filter((s) => s.done).length}/${mine.length} | ${mine.filter((s) => s.first).length}/${mine.length} | ${mine.filter((s) => s.isError).length} | ${median(mine.map((s) => s.turns))} | ${secs(median(walls))} | ${secs(quantile(walls, 0.9))} | ${secs(median(mine.flatMap((s) => s.turnLatencies)))} | ${mine.reduce((a, s) => a + (s.costUsd ?? 0), 0).toFixed(2)} | ${tokens.toLocaleString()} | ${tokens ? Math.round((100 * cache) / tokens) : 0}% | ${mine.reduce((a, s) => a + s.cacheWrite, 0).toLocaleString()} | ${mine.reduce((a, s) => a + s.out, 0).toLocaleString()} | ${mine.reduce((a, s) => a + s.toolSearch, 0)} | ${mean(mine.map((s) => s.opens)).toFixed(2)} | ${mine.reduce((a, s) => a + s.skillReads, 0)} |`)
}

console.log(`\nWorkflow tasks (the ${TRACE_TASKS.filter((t) => isWorkflowTask(t.id)).length} whose skill shares a group's name) against the other ${TRACE_TASKS.filter((t) => !isWorkflowTask(t.id)).length}:\n`)
console.log('| Condition | Model | Workflow done | Workflow median turns | Workflow p50 wall s | Other done | Other median turns | Other p50 wall s |')
console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: |')
for (const [key, mine] of byCondition) {
  const [condition, model] = key.split('|')
  const part = (xs: Scored[]) => [`${xs.filter((s) => s.done).length}/${xs.length}`, String(median(xs.map((s) => s.turns))), secs(median(xs.map((s) => s.durationMs ?? 0)))]
  console.log(`| ${condition} | ${model} | ${[...part(mine.filter((s) => s.workflow)), ...part(mine.filter((s) => !s.workflow))].join(' | ')} |`)
}

console.log('\nPer task (done ✓/✗, first step, then the calls in order; ! marks a tool error):\n')
const conds = [...byCondition.keys()]
console.log(`| Task | ${conds.map((c) => c.replace('|', ' / ').replace('claude-', '')).join(' | ')} |`)
console.log(`| :-- | ${conds.map(() => ':--').join(' | ')} |`)
for (const task of TRACE_TASKS) {
  const cells = conds.map((c) => {
    const s = scored.find((x) => `${x.condition}|${x.model}` === c && x.taskId === task.id)
    if (!s) return '-'
    return `${s.done ? '✓' : '✗'}${s.first ? '' : ' (first step off)'} ${s.calls.slice(0, 6).join(', ')}${s.calls.length > 6 ? ', …' : ''}${s.isError ? ' ERROR' : ''}`
  })
  console.log(`| ${task.id} | ${cells.join(' | ')} |`)
}
