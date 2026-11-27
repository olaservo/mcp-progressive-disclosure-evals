// Scores agent-run.ts and agent-ref.ts result files. Completion is re-derived from the recorded calls with the rubrics in
// agent-tasks.ts, so a rubric change applies to old runs too.
// Usage: tsx scripts/agent-score.ts [--as-committed] results/agent/<file>.jsonl [more files]
// --as-committed scores with the string-body handling the rubrics had when they were committed, before the runs.
import { readFileSync } from 'node:fs'
import { CHAINS, SCENARIOS, rubricOptions, type AgentCall } from './agent-tasks.js'

type Call = AgentCall & { via?: string; valid?: boolean; added?: number }
type Request = { kind: 'request'; session: string; arm: string; model: string; scenario: string; sample: number; phase: number; turn: number; index: number; afterOpen: boolean; promptTokens?: number; cachedTokens?: number; cacheWriteTokens?: number; completionTokens?: number; ttftMs?: number; totalMs?: number; retries?: number; calls: Call[] }
type PhaseRow = { kind: 'phase'; session: string; phase: number; costUsd: number }
type SessionRow = { kind: 'session'; session: string; arm: string; model: string; scenario: string; sample: number; done?: boolean[]; error?: string }
type Row = Request | PhaseRow | SessionRow | { kind: 'header' }

/**
 * USD per million tokens, from baseten.co/pricing and DeepInfra's model pages on 2026-11-12. DeepInfra lists Qwen3.6's
 * cached input at the input price and no cached price for Gemma. The reference rows carry the host's own cost.
 */
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  'zai-org/GLM-5.3-Flash:baseten': { input: 0.15, cached: 0.03, output: 0.5 },
  'deepseek-ai/DeepSeek-V4.1-Flash:baseten': { input: 0.3, cached: 0.007, output: 1.2 },
  'Qwen/Qwen3.6-35B-A3B:deepinfra': { input: 0.1, cached: 0.1, output: 0.95 },
  'google/gemma-4-26B-A4B-it:deepinfra': { input: 0.07, cached: 0.07, output: 0.34 }
}
const HELPERS = new Set(['list_groups', 'open_group', 'read_skill', 'call_tool', 'ToolSearch'])

rubricOptions.asCommitted = process.argv.includes('--as-committed')
const files = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
if (files.length === 0) throw new Error('pass one or more results/agent/*-agent-*.jsonl files')
// A file run with --shared, where sessions share one tool block, scores as its own arm, and so do runs with padded results,
// arm C with the lenient call_tool wrapper, runs against a server other than the two deployed subset Workers, and runs
// sent to a provider's own endpoint (--base-url).
const rows = files.flatMap((file) => {
  const parsed = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Row)
  const header = parsed.find((r) => r.kind === 'header') as { sharedTools?: boolean; listingInTool?: boolean; padResults?: number; wrapper?: string; groups?: number; endpoint?: string } | undefined
  const suffix = `${header?.sharedTools ? ' shared' : ''}${header?.wrapper === 'lenient' ? ' lenient' : ''}${header?.listingInTool ? ' listing in tool' : ''}${header?.padResults ? ` pad ${header.padResults}` : ''}${(header?.groups ?? 0) > 60 ? ' full catalog' : ''}${header?.endpoint ? ' direct' : ''}`
  return suffix ? parsed.map((r) => ('arm' in r ? { ...r, arm: `${r.arm}${suffix}` } : r)) : parsed
})
const requests = rows.filter((r): r is Request => r.kind === 'request')
const phaseCost = new Map(rows.filter((r): r is PhaseRow => r.kind === 'phase').map((r) => [`${r.session}|${r.phase}`, r.costUsd]))

type Scored = { arm: string; model: string; scenario: string; sample: number; error?: string; requests: Request[]; done: boolean[]; /** Cumulative through each phase. */ cost: number[]; input: number[]; uncached: number[] }
const everySession: Scored[] = rows.filter((r): r is SessionRow => r.kind === 'session').map((s) => {
  const mine = requests.filter((r) => r.session === s.session).sort((a, b) => a.index - b.index)
  const scenario = [...SCENARIOS, ...CHAINS].find((x) => x.id === s.scenario)!
  const price = PRICES[s.model]
  const done: boolean[] = []
  const cost: number[] = []
  const input: number[] = []
  const uncached: number[] = []
  let c = 0
  let i = 0
  let u = 0
  for (const [p, phase] of scenario.phases.entries()) {
    const inPhase = mine.filter((r) => r.phase === p + 1)
    // A session that ended in an error keeps only the phases it finished.
    if (inPhase.length === 0 || (s.error && p >= (s.done?.length ?? 0))) break
    done.push(phase.done(inPhase.flatMap((r) => r.calls).filter((call) => !HELPERS.has(call.name))))
    for (const r of inPhase) {
      const prompt = r.promptTokens ?? 0
      const cached = r.cachedTokens ?? 0
      i += prompt
      u += prompt - cached
      if (price) c += ((prompt - cached) * price.input + cached * price.cached + (r.completionTokens ?? 0) * price.output) / 1e6
    }
    if (!price) c += phaseCost.get(`${s.session}|${p + 1}`) ?? 0
    cost.push(c)
    input.push(i)
    uncached.push(u)
  }
  return { arm: s.arm, model: s.model, scenario: s.scenario, sample: s.sample, error: s.error, requests: mine, done, cost, input, uncached }
})

// A session that ended in an error is listed at the end. It is left out of the tables when it finished no phase, or
// when the same arm, model, scenario and sample was run again without an error.
const cellOf = (s: Scored) => `${s.arm}|${s.model}|${s.scenario}|${s.sample}`
const rerun = new Set(everySession.filter((s) => !s.error).map(cellOf))
const sessions = everySession.filter((s) => !(s.error && (s.done.length === 0 || rerun.has(cellOf(s)))))

/** The longest scenario among the sessions read: 6, or 30 for the chained ones. */
const PHASES = Math.max(6, ...sessions.map((x) => [...SCENARIOS, ...CHAINS].find((y) => y.id === x.scenario)!.phases.length))

const quantile = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 1e-9))]! : 0 }
const median = (xs: number[]) => quantile(xs, 0.5)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '-')
const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))
const short = (model: string) => model.replace(/^.*\//, '').replace(/:.*$/, '').replace(/^claude-/, '')
const ARM_ORDER = ['A', 'B', 'C', 'D', 'A direct', 'B direct', 'C direct', 'D direct', 'A shared', 'B shared', 'C shared', 'ref-groups-rec', 'ref-flat-toolsearch']
const cells = [...new Set(sessions.map((s) => `${s.arm}|${s.model}`))].sort((a, b) => {
  const [aa, am] = a.split('|') as [string, string]
  const [ba, bm] = b.split('|') as [string, string]
  const rank = (arm: string) => (ARM_ORDER.includes(arm) ? ARM_ORDER.indexOf(arm) : ARM_ORDER.length)
  return am.localeCompare(bm) || rank(aa) - rank(ba) || aa.localeCompare(ba)
})
const of = (cell: string) => sessions.filter((s) => `${s.arm}|${s.model}` === cell)
const name = (cell: string) => { const [arm, model] = cell.split('|') as [string, string]; return `${short(model)} | ${arm}` }

console.log(`Agent runs: ${files.length} files, ${sessions.length} sessions, ${requests.length} requests. A phase is done when its rubric in agent-tasks.ts holds over the calls the server accepted during it. A full task is a session's first 3 or all 6 phases done. Arguments are valid when they pass the tool's published input schema; rejected calls are those the server answered with an error.\n`)
console.log('| Model | Arm | Sessions | Errors | Phases done | Full task, 3 phases | Full task, every phase | Median requests | Group opens per session | Server tool calls | Valid arguments | Rejected by server |')
console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
for (const cell of cells) {
  const mine = of(cell)
  const phases = mine.flatMap((s) => s.done)
  const calls = mine.flatMap((s) => s.requests.flatMap((r) => r.calls)).filter((call) => !HELPERS.has(call.name))
  const checked = calls.filter((call) => call.valid !== undefined)
  const opens = mine.map((s) => s.requests.flatMap((r) => r.calls).filter((call) => call.name === 'open_group' && !call.isError).length)
  const full = (n: number) => `${mine.filter((s) => s.done.length >= n && s.done.slice(0, n).every(Boolean)).length}/${mine.filter((s) => s.done.length >= n).length}`
  console.log(`| ${name(cell)} | ${mine.length} | ${mine.filter((s) => s.error).length} | ${phases.filter(Boolean).length}/${phases.length} | ${full(3)} | ${full(PHASES)} | ${median(mine.map((s) => s.requests.length))} | ${mean(opens).toFixed(2)} | ${calls.length} | ${checked.length ? pct(checked.filter((call) => call.valid).length, checked.length) : '-'} | ${pct(calls.filter((call) => call.isError).length, calls.length)} |`)
}

const complete = (cell: string) => of(cell).filter((s) => s.cost.length === PHASES)
/** Every phase of a six-phase scenario, every sixth of a chained one. */
const shown = PHASES <= 6 ? Array.from({ length: PHASES }, (_, p) => p) : Array.from({ length: PHASES / 6 }, (_, i) => 6 * i + 5)
const through = (title: string, pick: (s: Scored) => number[], show: (n: number) => string) => {
  console.log(`\n${title}, mean over the sessions that ran all ${PHASES} phases:\n`)
  console.log(`| Model | Arm | Sessions | ${shown.map((p) => `Phase ${p + 1}`).join(' | ')} |`)
  console.log(`| :-- | :-- | --: | ${shown.map(() => '--:').join(' | ')} |`)
  for (const cell of cells) {
    const mine = complete(cell)
    if (mine.length === 0) continue
    console.log(`| ${name(cell)} | ${mine.length} | ${shown.map((p) => show(mean(mine.map((s) => pick(s)[p]!)))).join(' | ')} |`)
  }
}
through('Cumulative cost in USD at list price through each phase', (s) => s.cost, (n) => n.toFixed(4))
through('Cumulative input tokens through each phase', (s) => s.input, k)
through('Cumulative input tokens not read from cache through each phase', (s) => s.uncached, k)

// Chained sessions only: where appending passes all schemas up front. A pair is an arm B session and the arm A session of
// the same model, scenario and sample. Its phase is the first from which arm B's cumulative cost stays above arm A's.
if (PHASES > 6) {
  console.log(`\nWhere arm B's cumulative cost passes arm A's. A pair is an arm B session and the arm A session of the same model, scenario and sample. Its phase is the first from which arm B stays above arm A.\n`)
  console.log(`| Model | Arm B | Arm A | Pairs | Phase, per pair | Arm B cost over arm A's at phase ${PHASES}, paired sessions |`)
  console.log('| :-- | :-- | :-- | --: | :-- | --: |')
  for (const cell of cells) {
    const [arm, model] = cell.split('|') as [string, string]
    if (!/^B( |$)/.test(arm)) continue
    for (const other of [`A${arm.slice(1)}`, `A shared${arm.slice(1)}`]) {
      const pairs = complete(cell).flatMap((b) => complete(`${other}|${model}`).filter((a) => a.scenario === b.scenario && a.sample === b.sample).slice(0, 1).map((a) => ({ a, b })))
      if (pairs.length === 0) continue
      const from = pairs.map(({ a, b }) => b.cost.map((c, p) => c > a.cost[p]!).lastIndexOf(false) + 2).sort((x, y) => x - y)
      const ratio = mean(pairs.map(({ b }) => b.cost[PHASES - 1]!)) / mean(pairs.map(({ a }) => a.cost[PHASES - 1]!))
      console.log(`| ${short(model)} | ${arm} | ${other} | ${pairs.length} | ${from.map((p) => (p > PHASES ? `not in ${PHASES}` : String(p))).join(', ')} | ${ratio.toFixed(2)} |`)
    }
  }
}

// "Re-read" is the part of the previous request's prompt that this request did not get from cache: what a tool change costs,
// apart from the new content any request adds.
console.log("\nThe request after a group open against a session's other requests. Re-read tokens are the part of the previous request's prompt not served from cache. The first request of a session is left out.\n")
console.log('| Model | Arm | Requests after an open | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms | Other requests | Median re-read tokens | Median re-read share | Requests with over half re-read | Median first token ms |')
console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |')
for (const cell of cells) {
  const pairs = of(cell).flatMap((s) => s.requests.slice(1).map((r, i) => ({ r, previous: s.requests[i]!.promptTokens ?? 0 }))).filter((x) => x.previous > 0)
  const reread = (x: (typeof pairs)[number]) => Math.max(0, x.previous - (x.r.cachedTokens ?? 0))
  const part = (xs: typeof pairs) => [String(xs.length), k(median(xs.map(reread))), xs.length ? `${Math.round(100 * median(xs.map((x) => reread(x) / x.previous)))}%` : '-', String(xs.filter((x) => reread(x) / x.previous > 0.5).length), String(Math.round(median(xs.map((x) => x.r.ttftMs ?? x.r.totalMs ?? 0))))]
  console.log(`| ${name(cell)} | ${[...part(pairs.filter((x) => x.r.afterOpen)), ...part(pairs.filter((x) => !x.r.afterOpen))].join(' | ')} |`)
}

console.log('\nPhases done, by scenario and phase:\n')
console.log(`| Scenario | Phase | Groups | ${cells.map(name).map((n) => n.replace(' | ', ' ')).join(' | ')} |`)
console.log(`| :-- | --: | :-- | ${cells.map(() => '--:').join(' | ')} |`)
for (const scenario of [...SCENARIOS, ...CHAINS].filter((x) => sessions.some((s) => s.scenario === x.id))) {
  for (const [p, phase] of scenario.phases.entries()) {
    const counts = cells.map((cell) => {
      const ran = of(cell).filter((s) => s.scenario === scenario.id && s.done.length > p)
      return ran.length ? `${ran.filter((s) => s.done[p]).length}/${ran.length}` : '-'
    })
    console.log(`| ${scenario.id} | ${p + 1} | ${phase.groups[0]} | ${counts.join(' | ')} |`)
  }
}

const failed = everySession.filter((s) => s.error)
if (failed.length) {
  console.log('\nSessions that ended in an error:')
  for (const s of failed) console.log(`- ${short(s.model)} ${s.arm} ${s.scenario} #${s.sample}: ${s.error!.slice(0, 200)}`)
}
