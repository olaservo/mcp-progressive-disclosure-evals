// Runs the scenarios of agent-tasks.ts through headless Claude Code, one process per scenario with each phase as a user turn,
// and writes the same rows as agent-run.ts. This is the reference for a host with deferred tool loading.
//
// Usage: tsx scripts/agent-ref.ts --condition groups-rec|flat-toolsearch [--models a,b] [--scenarios id,id] [--samples N] [--phases N] [--label name]
//
// Conditions, as in trace-run.ts:
//   groups-rec       the mod against the opt2-rec Worker, scoped tools deferred behind the host's tool search
//   flat-toolsearch  the flat Worker as an MCP server behind the host's tool search; the mod for skills
import { execSync, spawn } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { PREAMBLE } from './trace-tasks.js'
import { SCENARIOS, type AgentCall } from './agent-tasks.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const CONDITIONS = ['groups-rec', 'flat-toolsearch'] as const
type Condition = (typeof CONDITIONS)[number]
const condition = opt('condition', 'groups-rec') as Condition
if (!CONDITIONS.includes(condition)) throw new Error(`Unknown condition ${condition}; one of ${CONDITIONS.join(', ')}`)
const models = opt('models', 'claude-sonnet-5-5')!.split(',')
const only = opt('scenarios')?.split(',')
const samples = Number(opt('samples', '1'))
const phaseLimit = Number(opt('phases', '6'))
const label = opt('label', `ref-${condition}`)!
const budget = opt('budget', '4')!
const OPT2_REC = 'https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp'
const FLAT = 'https://pd-groups-flat.olahungerford.workers.dev/mcp'
/** The literal the mod's source defaults to, replaced in the copy. */
const MOD_DEFAULT_URL = 'https://pd-groups-opt2.olahungerford.workers.dev/mcp'
const url = condition === 'groups-rec' ? OPT2_REC : FLAT

// trace-run.ts's list, plus the host's scheduling tools, which one round-two session reached for.
const BUILTIN_OFF = ['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'TodoWrite', 'Skill', 'Workflow', 'CronCreate', 'CronDelete', 'CronList']
const CLAUDE = process.env.CLAUDE_BIN ?? [join(homedir(), '.local', 'bin', 'claude.exe'), join(homedir(), '.local', 'bin', 'claude')].find((p) => existsSync(p)) ?? 'claude'

/** A gitignored copy of the mod pointed at this condition's server, as trace-run.ts makes one. */
function modDir(): string {
  const source = resolve('mods', 'groups')
  const copy = resolve('mods', `.groups-agent-${condition}--${models.map((m) => m.replace(/^claude-/, '')).join('+')}`)
  mkdirSync(join(copy, '.claude-plugin'), { recursive: true })
  mkdirSync(join(copy, 'hooks'), { recursive: true })
  const manifest = JSON.parse(readFileSync(join(source, '.claude-plugin', 'plugin.json'), 'utf8')) as { version: string; userConfig: Record<string, { default: unknown }> }
  manifest.userConfig.url!.default = url
  writeFileSync(join(copy, '.claude-plugin', 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n')
  copyFileSync(join(source, 'hooks', 'hooks.json'), join(copy, 'hooks', 'hooks.json'))
  const code = readFileSync(join(source, 'hooks', 'register.ts'), 'utf8')
  if (!code.includes(MOD_DEFAULT_URL)) throw new Error(`mod source no longer contains: ${MOD_DEFAULT_URL}`)
  writeFileSync(join(copy, 'hooks', 'register.ts'), code.replace(MOD_DEFAULT_URL, url))
  return copy
}
const MOD = modDir()

type Usage = { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number; output_tokens?: number }
type Block = { type: string; text?: string; name?: string; id?: string; input?: Record<string, unknown>; tool_use_id?: string; is_error?: boolean }
type Event = { type: string; message?: { id?: string; content?: Block[] | string; usage?: Usage }; total_cost_usd?: number; num_turns?: number; is_error?: boolean; result?: string }
type CallRow = AgentCall & { via: string; id?: string; group?: string }
type RequestRow = { id: string; calls: CallRow[]; usage: Usage; text: string; startedMs: number }

const PREFIXES = ['mcp__groups__', 'mcp__cf__']
const strip = (name: string) => PREFIXES.reduce((n, p) => (n.startsWith(p) ? n.slice(p.length) : n), name)
const HELPERS = new Set(['list_groups', 'open_group', 'read_skill', 'ToolSearch'])

const scenarios = only ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS
mkdirSync('results', { recursive: true })
const out = join('results', `${new Date().toISOString().slice(0, 10)}-agent-${label}.jsonl`)
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() } catch { return undefined } })()
const arm = `ref-${condition}`
if (!existsSync(out)) writeFileSync(out, JSON.stringify({ kind: 'header', arm, url, commit, models, scenarios: scenarios.map((s) => s.id), samples, phases: phaseLimit, settings: 'headless Claude Code, default effort, one process per scenario' }) + '\n')
console.error(`${arm}: ${scenarios.length} scenarios x ${samples} samples x ${models.length} models -> ${out} (mod copy ${MOD})`)

async function runSession(model: string, scenario: (typeof SCENARIOS)[number], sample: number): Promise<void> {
  const argv = [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
    '--model', model,
    '--max-budget-usd', budget,
    '--append-system-prompt', PREAMBLE,
    '--disallowedTools', ...BUILTIN_OFF,
    '--plugin-dir', MOD,
    '--strict-mcp-config',
    '--mcp-config', JSON.stringify({ mcpServers: condition === 'groups-rec' ? {} : { cf: { type: 'http', url: FLAT } } }),
    '--allowedTools', 'mcp__groups__*', ...(condition === 'groups-rec' ? [] : ['mcp__cf__*'])
  ]
  const child = spawn(CLAUDE, argv, { cwd: process.cwd(), env: { ...process.env, CLAUDE_CODE_ENABLE_FUNCTION_HOOKS: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-500) })
  const exited = new Promise<void>((done) => child.on('close', () => done()))
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]()
  // A local id: the host's session id stays out of the results.
  const base = { session: randomUUID(), arm, model, scenario: scenario.id, sample }
  const done: boolean[] = []
  let index = 0
  let costSoFar = 0
  let error: string | undefined
  let afterOpen = false
  try {
    for (const [p, phase] of scenario.phases.slice(0, phaseLimit).entries()) {
      // The next turn is written only after the last one's result, so no turn arrives mid-task.
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: phase.task }] } }) + '\n')
      const requests: RequestRow[] = []
      const errored = new Set<string>()
      let mark = Date.now()
      let result: Event | undefined
      while (!result) {
        const next = await lines.next()
        if (next.done) throw new Error(`claude exited before phase ${p + 1} finished: ${stderr}`)
        let event: Event
        try { event = JSON.parse(next.value) as Event } catch { continue }
        if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
          const id = event.message.id ?? `msg-${requests.length}`
          // One API response arrives as one event per content block, each with the same id.
          let row = requests.find((r) => r.id === id)
          if (!row) { row = { id, calls: [], usage: {}, text: '', startedMs: Date.now() - mark }; requests.push(row) }
          row.usage = event.message.usage ?? row.usage
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) row.text += block.text
            if (block.type !== 'tool_use' || !block.name) continue
            const name = strip(block.name)
            row.calls.push({ name, via: name, id: block.id, args: block.input ?? {}, isError: false, ...(name === 'open_group' ? { group: String(block.input?.name ?? '') } : {}) })
          }
        } else if (event.type === 'user' && event.message && Array.isArray(event.message.content)) {
          for (const block of event.message.content) if (block.type === 'tool_result' && block.is_error && block.tool_use_id) errored.add(block.tool_use_id)
          mark = Date.now()
        } else if (event.type === 'result') {
          result = event
        }
      }
      const phaseCalls: AgentCall[] = []
      for (const [i, row] of requests.entries()) {
        for (const call of row.calls) {
          call.isError = !!call.id && errored.has(call.id)
          if (!HELPERS.has(call.name)) phaseCalls.push(call)
        }
        const u = row.usage
        appendFileSync(out, JSON.stringify({ kind: 'request', ...base, phase: p + 1, turn: i + 1, index: ++index, afterOpen, promptTokens: (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), cachedTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0, completionTokens: u.output_tokens, totalMs: row.startedMs, calls: row.calls.map(({ id: _id, ...call }) => call), text: row.text }) + '\n')
        afterOpen = row.calls.some((call) => call.name === 'open_group' && !call.isError)
      }
      const cost = result.total_cost_usd ?? costSoFar
      appendFileSync(out, JSON.stringify({ kind: 'phase', ...base, phase: p + 1, costUsd: cost - costSoFar, isError: result.is_error === true }) + '\n')
      costSoFar = cost
      done.push(phase.done(phaseCalls))
      if (result.is_error) throw new Error(`phase ${p + 1} ended in an error: ${String(result.result).slice(0, 200)}`)
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  child.stdin.end()
  await exited
  appendFileSync(out, JSON.stringify({ kind: 'session', ...base, requests: index, done, costUsd: costSoFar, error }) + '\n')
  console.error(`${arm} ${model} ${scenario.id} #${sample}: ${error ? `ERROR ${error.slice(0, 160)} ` : ''}${done.map((d) => (d ? '✓' : '✗')).join('')} ${index} requests $${costSoFar.toFixed(2)}`)
}

for (const model of models) for (const scenario of scenarios) for (let sample = 1; sample <= samples; sample++) await runSession(model, scenario, sample)
console.error(`rows: ${out}`)
