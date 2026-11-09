// Scores trace runs from their index rows and session files. Usage: tsx scripts/trace-score.ts [--label traces]
import { readFileSync, existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { TRACE_TASKS, type Call, type Picks } from './trace-tasks.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const label = opt('label', 'traces')!
const index = resolve('results', 'traces', label, 'index.jsonl')

type Row = { condition: string; model: string; taskId: string; sessionId?: string; file?: string; numTurns?: number; durationMs?: number; costUsd?: number; isError?: boolean; answer?: string }
type Usage = { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number }
type Block = { type: string; name?: string; id?: string; input?: Record<string, unknown>; tool_use_id?: string; content?: unknown; is_error?: boolean }
type Line = { type: string; message?: { id?: string; role?: string; content?: Block[] | string; usage?: Usage } }

const PREFIXES = ['mcp__groups__', 'mcp__cf__']
const strip = (name: string) => PREFIXES.reduce((n, p) => (n.startsWith(p) ? n.slice(p.length) : n), name)

function readSession(file: string): { picks: Picks; turns: number; usage: Required<Usage>; toolSearch: number; firstStep?: string } {
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as Line } catch { return undefined } }).filter((l): l is Line => !!l)
  const picks: Picks = { groups: [], skills: [], tools: [] }
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
  const seen = new Set<string>()
  for (const line of lines) {
    if (line.type !== 'assistant' || !line.message) continue
    const id = line.message.id ?? `line-${turns}-${Math.random()}`
    if (!seen.has(id)) {
      seen.add(id)
      turns++
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
      if (name === 'read_skill') { const s = String(input.name ?? ''); picks.skills.push(s); firstStep ??= `skill:${s}`; continue }
      if (name === 'list_groups') continue
      const call: Call = { name, args: input, isError: !!b.id && errors.has(b.id) }
      picks.tools.push(call)
      firstStep ??= name
    }
  }
  return { picks, turns, usage, toolSearch, firstStep }
}

function firstPickOk(task: (typeof TRACE_TASKS)[number], firstStep: string | undefined, picks: Picks): boolean {
  if (firstStep === undefined) return task.firstPick.includes('none')
  return task.firstPick.some((p) => (p === 'none' ? false : p.startsWith('skill:') ? firstStep === p || (picks.groups[0] === p.slice(6)) : firstStep === p || firstStep.startsWith(p)))
}

// The redacted copy's index carries paths relative to its own folder, so it scores the same way.
const rows = readFileSync(index, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Row).map((r) => ({ ...r, file: r.file && !isAbsolute(r.file) ? join(resolve('results', 'traces', label), r.file) : r.file }))
type Scored = Row & { done: boolean; first: boolean; turns: number; tokensIn: number; cacheRead: number; out: number; toolSearch: number; firstStep?: string; calls: string[] }
const scored: Scored[] = rows.map((row) => {
  const task = TRACE_TASKS.find((t) => t.id === row.taskId)!
  if (!row.file || !existsSync(row.file)) return { ...row, done: false, first: false, turns: 0, tokensIn: 0, cacheRead: 0, out: 0, toolSearch: 0, calls: [] }
  const s = readSession(row.file)
  return {
    ...row,
    done: !row.isError && task.done(s.picks, row.answer ?? ''),
    first: firstPickOk(task, s.firstStep, s.picks),
    turns: s.turns,
    tokensIn: s.usage.input_tokens + s.usage.cache_creation_input_tokens + s.usage.cache_read_input_tokens,
    cacheRead: s.usage.cache_read_input_tokens,
    out: s.usage.output_tokens,
    toolSearch: s.toolSearch,
    firstStep: s.firstStep,
    calls: [...s.picks.groups.map((g) => `open:${g}`), ...s.picks.skills.map((k) => `skill:${k}`), ...s.picks.tools.map((c) => `${c.name}${c.isError ? '!' : ''}`)]
  }
})

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0 }
const groupsOf = <T, K extends string>(xs: T[], key: (x: T) => K) => { const m = new Map<K, T[]>(); for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]); return m }

console.log(`Trace runs: ${label}, ${scored.length} sessions. "Done" is the task's completion rubric over the calls the session made; "First step" is whether the first group opened, skill read or tool called fits the task, as in the selection trial.\n`)
console.log('| Condition | Model | Done | First step | Errors | Median turns | Median wall s | Total cost USD | Input tokens (incl. cache) | Cache read share | Output tokens | ToolSearch calls |')
console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
for (const [key, mine] of groupsOf(scored, (s) => `${s.condition}|${s.model}`)) {
  const [condition, model] = key.split('|')
  const tokens = mine.reduce((a, s) => a + s.tokensIn, 0)
  const cache = mine.reduce((a, s) => a + s.cacheRead, 0)
  console.log(`| ${condition} | ${model} | ${mine.filter((s) => s.done).length}/${mine.length} | ${mine.filter((s) => s.first).length}/${mine.length} | ${mine.filter((s) => s.isError).length} | ${median(mine.map((s) => s.turns))} | ${Math.round(median(mine.map((s) => (s.durationMs ?? 0) / 1000)))} | ${mine.reduce((a, s) => a + (s.costUsd ?? 0), 0).toFixed(2)} | ${tokens.toLocaleString()} | ${tokens ? Math.round((100 * cache) / tokens) : 0}% | ${mine.reduce((a, s) => a + s.out, 0).toLocaleString()} | ${mine.reduce((a, s) => a + s.toolSearch, 0)} |`)
}

console.log('\nPer task (done ✓/✗, first step, then the calls in order; ! marks a tool error):\n')
const conds = [...new Set(scored.map((s) => `${s.condition}|${s.model}`))]
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
