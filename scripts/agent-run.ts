// Runs the scenarios of agent-tasks.ts through a minimal agent loop on the Hugging Face router, for models Claude Code
// cannot drive. Writes one JSONL row per model request with the provider's token and cache counts and the time to first token.
// Score with agent-score.ts.
//
// Usage: tsx scripts/agent-run.ts --arm A|B|C [--models a,b] [--scenarios id,id] [--samples N] [--phases N] [--parallel N] [--label name] [--shared] [--only-samples 2,3] [--env <.env path>]
//
// Arms, each on the same model, scenarios and system prompt:
//   A  every tool schema of the flat server in `tools` from the first request
//   B  `tools` starts as list_groups, open_group and read_skill; each open appends the group's tools for the next request
//   C  `tools` is fixed at list_groups, open_group, read_skill and call_tool; open_group returns the group's schemas as text
//
// Every session starts cold: its id leads the system prompt and ends the first tool's description. Both Baseten models
// showed cache reads on tool blocks a session had never sent (2026-11-12), so the id in the system prompt alone leaves the
// tool block shared between sessions. --shared leaves the id out of the tools, as a batch of sessions with one tool list would run.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as z from 'zod/v4'
import { Ajv, type ValidateFunction } from 'ajv'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { getEncoding } from 'js-tiktoken'
import { PREAMBLE } from './trace-tasks.js'
import { SCENARIOS, type AgentCall } from './agent-tasks.js'

const GROUPS = 'io.modelcontextprotocol/groups'
const SKILLS = 'io.modelcontextprotocol/skills'
const Loose = z.looseObject({})
const encoding = getEncoding('o200k_base')

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
type Arm = 'A' | 'B' | 'C'
const arm = opt('arm', 'B') as Arm
if (!['A', 'B', 'C'].includes(arm)) throw new Error(`Unknown arm ${arm}; one of A, B, C`)
const models = opt('models', 'zai-org/GLM-5.3-Flash:baseten,deepseek-ai/DeepSeek-V4.1-Flash:baseten')!.split(',')
const only = opt('scenarios')?.split(',')
const samples = Number(opt('samples', '1'))
const phaseLimit = Number(opt('phases', '6'))
const parallel = Number(opt('parallel', '2'))
const maxTurns = Number(opt('max-turns', '10'))
const label = opt('label', `arm-${arm.toLowerCase()}`)!
const envFile = opt('env')
const shared = args.includes('--shared')
// --only-samples re-runs the named sample numbers, for sessions that ended in an error.
const onlySamples = opt('only-samples')?.split(',').map(Number)
const url = opt('url', arm === 'A' ? 'https://pd-groups-flat.olahungerford.workers.dev/mcp' : 'https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')!

// Keys come from --env or the environment. Values are never printed.
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}
const hfToken = () => {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN
  const file = join(homedir(), '.cache', 'huggingface', 'token')
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : undefined
}

type Named = { name: string; description?: string }
type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
type GroupBody = { instructions?: string; tools?: McpTool[]; resources?: { uri: string }[]; groups?: Named[] }
type SkillEntry = { uri: string; frontmatter?: { name: string; description?: string }; resources?: { uri: string; digest: string }[] | 'dynamic' }
type FnTool = { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

const firstLine = (text = '') => text.split('\n')[0]!.trim()
const fn = (name: string, description: string, parameters: Record<string, unknown>): FnTool => ({ type: 'function', function: { name, description, parameters } })
const asFn = (tool: McpTool) => fn(tool.name, tool.description ?? '', tool.inputSchema ?? { type: 'object' })

// The server's listings, read once. Every group is fetched so each tool's schema is known for validation.
const client = new Client({ name: 'groups-agent-run', version: '0.1.0' }, { capabilities: { extensions: arm === 'A' ? { [SKILLS]: {} } : { [GROUPS]: {}, [SKILLS]: {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL(url)))
const flatTools: McpTool[] = arm === 'A' ? ((await client.listTools()).tools as McpTool[]) : []
const groups: Named[] = arm === 'A' ? [] : ((await client.request({ method: 'groups/list', params: {} }, Loose)) as { groups?: Named[] }).groups ?? []
const skills = (((await client.request({ method: 'skills/list', params: {} }, Loose)) as { skills?: SkillEntry[] }).skills ?? []).filter((entry) => entry.frontmatter?.name)
const groupBodies = new Map<string, GroupBody>()
for (const group of groups) groupBodies.set(group.name, (await client.request({ method: 'groups/get', params: { name: group.name } }, Loose)) as GroupBody)
const schemas = new Map<string, Record<string, unknown>>([...flatTools, ...[...groupBodies.values()].flatMap((body) => body.tools ?? [])].map((tool) => [tool.name, tool.inputSchema ?? { type: 'object' }]))

const ajv = new Ajv({ strict: false })
const validators = new Map<string, ValidateFunction | undefined>()
/** Whether the arguments validate against the tool's published input schema. Undefined for a tool the server does not have. */
function valid(name: string, input: unknown): boolean | undefined {
  if (!schemas.has(name)) return undefined
  if (!validators.has(name)) {
    try {
      validators.set(name, ajv.compile(schemas.get(name)!))
    } catch {
      validators.set(name, undefined)
    }
  }
  const validate = validators.get(name)
  return validate ? validate(input) === true : undefined
}

const LIST_GROUPS = fn('list_groups', 'List the capability groups the MCP server offers, each with a name and a description of when to use it. Call this to discover what is available before using a specialized tool.', { type: 'object', properties: {} })
const NAME_PARAM = { type: 'object', properties: { name: { type: 'string', description: 'The group name to open.' } }, required: ['name'] }
const OPEN_GROUP_B = fn('open_group', 'Open a capability group by name. Returns its instructions and makes its scoped tools callable for the rest of the session. Always open the relevant group before calling a specialized tool.', NAME_PARAM)
const OPEN_GROUP_C = fn('open_group', "Open a capability group by name. Returns its instructions and the schemas of its tools, which you then call through call_tool. Always open the relevant group before calling one of its tools.", NAME_PARAM)
const READ_SKILL = fn('read_skill', "Read a skill's instructions (its SKILL.md) by skill name or skill:// URI.", { type: 'object', properties: { name: { type: 'string', description: 'The skill name or its SKILL.md URI.' } }, required: ['name'] })
const CALL_TOOL = fn('call_tool', "Call a tool of an opened group. `name` is the tool's name and `arguments` is its arguments object, shaped as the tool's inputSchema from open_group says.", {
  type: 'object',
  properties: { name: { type: 'string', description: 'The tool name.' }, arguments: { type: 'object', description: "The tool's arguments." } },
  required: ['name', 'arguments']
})
const HELPERS = new Set(['list_groups', 'open_group', 'read_skill', 'call_tool'])

/** The catalog section of the system prompt, worded as the Claude Code mod words it, with arm C's call path. */
function section(): string {
  const skillLines = (shown: SkillEntry[]) => shown.map((s) => `- ${s.frontmatter!.name}: ${firstLine(s.frontmatter!.description)}`)
  if (arm === 'A') return ['# Skills over MCP', 'The MCP server in this session serves these skills. When a task matches one, call read_skill with its name before starting, then follow it.', '', "Skills (read_skill loads a skill's instructions):", ...skillLines(skills)].join('\n')
  const shown = skills.filter((s) => !groups.some((g) => g.name === s.frontmatter!.name))
  return [
    '# Capability groups over MCP',
    'This session is connected to an MCP server that discloses its tools in groups. Specialized tools are not',
    arm === 'B' ? 'loaded up front: each group bundles related tools that become callable only after you open the group.' : 'loaded up front: each group bundles related tools whose schemas you read by opening the group.',
    arm === 'B' ? 'When a task matches a group below, call open_group with its name first, then use the tools it reveals.' : 'When a task matches a group below, call open_group with its name first, then call its tools through call_tool.',
    'A group may list a skill; read_skill loads its instructions. Call list_groups to re-list at any time.',
    '',
    "Groups (open_group loads a group's tools and instructions):",
    ...groups.map((g) => `- ${g.name}: ${firstLine(g.description)}`),
    ...(shown.length > 0 ? ['', "Skills (read_skill loads a skill's instructions):", ...skillLines(shown)] : [])
  ].join('\n')
}

type Usage = { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } | null }
type Reply = { content: string; toolCalls: ToolCall[]; usage: Usage; finish?: string; ttftMs?: number; totalMs: number; retries: number }

/** One streamed chat completion. A 429 or 5xx is retried with a growing wait. */
async function complete(model: string, messages: Message[], tools: FnTool[], seed: number, session: string): Promise<Reply> {
  const request = JSON.stringify({ model, messages, tools, temperature: 0.2, seed, max_tokens: 4000, stream: true, stream_options: { include_usage: true }, chat_template_kwargs: { enable_thinking: false } })
  for (let attempt = 0; ; attempt++) {
    const started = Date.now()
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${hfToken()}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1', 'x-session-affinity': session },
      body: request
    })
    if (!response.ok || !response.body) {
      const detail = (await response.text()).slice(0, 300)
      if ((response.status === 429 || response.status >= 500) && attempt < 6) {
        await new Promise((resolve) => setTimeout(resolve, 5000 * 2 ** attempt))
        continue
      }
      throw new Error(`${model}: HTTP ${response.status} ${detail}`)
    }
    const reply: Reply = { content: '', toolCalls: [], usage: {}, totalMs: 0, retries: attempt }
    const decoder = new TextDecoder()
    let buffer = ''
    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end).trim()
        buffer = buffer.slice(end + 1)
        if (!line.startsWith('data:') || line === 'data: [DONE]') continue
        let event: { choices?: { delta?: { content?: string | null; reasoning_content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[]; usage?: Usage | null; error?: { message?: string } }
        try {
          event = JSON.parse(line.slice(5))
        } catch {
          continue
        }
        if (event.error) throw new Error(`${model}: stream error ${event.error.message ?? ''}`)
        if (event.usage) reply.usage = event.usage
        const choice = event.choices?.[0]
        if (!choice) continue
        const delta = choice.delta ?? {}
        if (reply.ttftMs === undefined && (delta.content || delta.reasoning_content || delta.tool_calls?.length)) reply.ttftMs = Date.now() - started
        if (delta.content) reply.content += delta.content
        for (const part of delta.tool_calls ?? []) {
          const call = (reply.toolCalls[part.index] ??= { id: '', type: 'function', function: { name: '', arguments: '' } })
          if (part.id) call.id = part.id
          if (part.function?.name) call.function.name += part.function.name
          if (part.function?.arguments) call.function.arguments += part.function.arguments
        }
        if (choice.finish_reason) reply.finish = choice.finish_reason
      }
    }
    reply.toolCalls = reply.toolCalls.filter(Boolean).map((call, i) => ({ ...call, id: call.id || `call_${i}` }))
    reply.totalMs = Date.now() - started
    return reply
  }
}

const textOf = (result: { content?: { type: string; text?: string }[] }) => (result.content ?? []).map((c) => (c.type === 'text' && typeof c.text === 'string' ? c.text : JSON.stringify(c))).join('\n')
const sha256 = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`

type CallRow = AgentCall & { via: string; valid?: boolean; group?: string; added?: number }
type Session = { id: string; tools: FnTool[]; opened: string[] }

/** groups/get as the mod answers it. Arm B appends the group's tools; arm C puts their schemas in the text. */
function openGroup(session: Session, name: string): { text: string; isError: boolean; added: number } {
  const body = groupBodies.get(name)
  if (!body) return { text: `open_group '${name}' failed: no such group.`, isError: true, added: 0 }
  const tools = body.tools ?? []
  let added = 0
  if (arm === 'B') {
    for (const tool of tools) {
      if (session.tools.some((t) => t.function.name === tool.name)) continue
      session.tools.push(asFn(tool))
      added++
    }
  }
  if (!session.opened.includes(name)) session.opened.push(name)
  const out = [`Opened '${name}'.`]
  if (body.instructions) out.push('', 'Instructions:', body.instructions)
  if (arm === 'C') out.push('', tools.length ? 'Tools (call each through call_tool):' : 'This group has no tools.', ...tools.map((tool) => JSON.stringify({ name: tool.name, description: tool.description ?? '', inputSchema: tool.inputSchema ?? { type: 'object' } })))
  else out.push('', tools.length ? `Tools now available: ${tools.map((t) => t.name).join(', ')}` : 'This group has no tools.')
  const skillDocs = (body.resources ?? []).filter((r) => r.uri.endsWith('/SKILL.md'))
  if (skillDocs.length) out.push('', `Skills this group lists (read_skill loads one): ${skillDocs.map((r) => r.uri).join(', ')}`)
  return { text: out.join('\n'), isError: false, added }
}

/** skills/get, then resources/read, refused unless the bytes match the digest the entry publishes. */
async function readSkill(session: Session, raw: string): Promise<{ text: string; isError: boolean; added: number }> {
  const skill = raw.trim().replace(/^skill:\/\//, '').replace(/^\/+|\/+$/g, '').replace(/\/SKILL\.md$/, '')
  if (!skill) return { text: 'read_skill requires a skill name.', isError: true, added: 0 }
  const out: string[] = []
  let added = 0
  if (groupBodies.has(skill) && !session.opened.includes(skill)) {
    const opened = openGroup(session, skill)
    out.push(opened.text, '')
    added = opened.added
  }
  const uri = `skill://${skill}/SKILL.md`
  try {
    const entry = ((await client.request({ method: 'skills/get', params: { uri } }, Loose)) as { skill: SkillEntry }).skill
    const read = (await client.readResource({ uri })) as { contents?: { text?: string }[] }
    const body = (read.contents ?? []).map((c) => c.text ?? '').join('')
    const published = Array.isArray(entry.resources) ? entry.resources.find((r) => r.uri === uri) : undefined
    if (!body || (published && sha256(body) !== published.digest)) return { text: `read_skill: ${uri} is empty or does not match its published digest. Not loaded.`, isError: true, added }
    out.push(`${uri}:`, body)
    return { text: out.join('\n'), isError: false, added }
  } catch (error) {
    return { text: `read_skill '${raw}' failed: ${error instanceof Error ? error.message : String(error)}`, isError: true, added }
  }
}

const parseArgs = (raw: string): Record<string, unknown> | undefined => {
  try {
    const value = JSON.parse(raw || '{}') as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** Runs one tool call. The returned row names the server tool reached, so call_tool scores as the tool it wrapped. */
async function execute(session: Session, call: ToolCall): Promise<{ text: string; row: CallRow }> {
  const via = call.function.name
  const input = parseArgs(call.function.arguments)
  if (!input) return { text: `${via}: the arguments are not a JSON object.`, row: { name: via, via, args: {}, isError: true } }
  if (via === 'list_groups') return { text: ['Available groups:', ...groups.map((g) => `- ${g.name}: ${firstLine(g.description)}`)].join('\n'), row: { name: via, via, args: input, isError: false } }
  if (via === 'open_group' && arm !== 'A') {
    const opened = openGroup(session, String(input.name ?? '').trim())
    return { text: opened.text, row: { name: via, via, args: input, isError: opened.isError, group: String(input.name ?? ''), added: opened.added } }
  }
  if (via === 'read_skill') {
    const read = await readSkill(session, String(input.name ?? ''))
    return { text: read.text, row: { name: via, via, args: input, isError: read.isError, added: read.added } }
  }
  let name = via
  let toolArgs = input
  if (via === 'call_tool' && arm === 'C') {
    name = String(input.name ?? '')
    // A model may pass the inner arguments as a JSON string; a client would parse it.
    const inner = typeof input.arguments === 'string' ? parseArgs(input.arguments) : (input.arguments as Record<string, unknown> | undefined)
    if (!name || !inner || typeof inner !== 'object') return { text: 'call_tool needs `name` and an `arguments` object.', row: { name: name || via, via, args: input, isError: true } }
    toolArgs = inner
  } else if (!session.tools.some((t) => t.function.name === via)) {
    return { text: arm === 'A' ? `Tool ${via} not found.` : `Tool ${via} is not available. Open its group with open_group first.`, row: { name: via, via, args: input, isError: true } }
  }
  const row: CallRow = { name, via, args: toolArgs, isError: false, valid: valid(name, toolArgs) }
  try {
    const result = (await client.callTool({ name, arguments: toolArgs })) as { content?: { type: string; text?: string }[]; isError?: boolean }
    row.isError = result.isError === true
    return { text: textOf(result) || (row.isError ? `${name} failed` : ''), row }
  } catch (error) {
    row.isError = true
    return { text: `${name} failed: ${error instanceof Error ? error.message : String(error)}`, row }
  }
}

const scenarios = only ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS
mkdirSync('results', { recursive: true })
const out = join('results', `${new Date().toISOString().slice(0, 10)}-agent-${label}.jsonl`)
const tokenCounts = new Map<number, number>()
/** o200k tokens of the tools array, by its length: the array only grows within an arm. */
const toolsTokens = (tools: FnTool[]) => {
  if (!tokenCounts.has(tools.length)) tokenCounts.set(tools.length, encoding.encode(JSON.stringify(tools)).length)
  return tokenCounts.get(tools.length)!
}
const startTools = (): FnTool[] => (arm === 'A' ? [READ_SKILL, ...flatTools.map(asFn)] : arm === 'B' ? [LIST_GROUPS, OPEN_GROUP_B, READ_SKILL] : [LIST_GROUPS, OPEN_GROUP_C, READ_SKILL, CALL_TOOL])
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() } catch { return undefined } })()
if (!existsSync(out)) {
  writeFileSync(out, JSON.stringify({ kind: 'header', arm, url, commit, models, scenarios: scenarios.map((s) => s.id), samples, phases: phaseLimit, maxTurns, sharedTools: shared, groups: groups.length, skills: skills.length, startTools: startTools().length, startToolsTokens: toolsTokens(startTools()), sectionTokens: encoding.encode(section()).length, settings: 'enable_thinking false, temperature 0.2, seeded, streamed' }) + '\n')
}
console.error(`arm ${arm} against ${url}: ${scenarios.length} scenarios x ${samples} samples x ${models.length} models -> ${out}`)

async function runSession(model: string, scenario: (typeof SCENARIOS)[number], sample: number): Promise<void> {
  const session: Session = { id: randomUUID(), tools: startTools(), opened: [] }
  if (!shared) session.tools[0] = fn(session.tools[0]!.function.name, `${session.tools[0]!.function.description} [session ${session.id}]`, session.tools[0]!.function.parameters)
  const messages: Message[] = [{ role: 'system', content: `Session ${session.id}.\n\n${PREAMBLE}\n\n${section()}` }]
  const base = { session: session.id, arm, model, scenario: scenario.id, sample }
  const done: boolean[] = []
  let index = 0
  let error: string | undefined
  let added = 0
  let afterOpen = false
  try {
    for (const [p, phase] of scenario.phases.slice(0, phaseLimit).entries()) {
      messages.push({ role: 'user', content: phase.task })
      const phaseCalls: AgentCall[] = []
      for (let turn = 1; turn <= maxTurns; turn++) {
        const reply = await complete(model, messages, session.tools, sample, session.id)
        const toolsSent = session.tools.length
        const toolsSentTokens = toolsTokens(session.tools)
        messages.push({ role: 'assistant', content: reply.content || null, ...(reply.toolCalls.length ? { tool_calls: reply.toolCalls } : {}) })
        const rows: CallRow[] = []
        const sentAfterOpen = afterOpen
        const sentAfterAdded = added
        afterOpen = false
        added = 0
        for (const call of reply.toolCalls) {
          const { text, row } = await execute(session, call)
          messages.push({ role: 'tool', tool_call_id: call.id, content: text })
          rows.push(row)
          if (!HELPERS.has(row.name)) phaseCalls.push(row)
          if ((row.name === 'open_group' || row.name === 'read_skill') && !row.isError) {
            afterOpen ||= row.name === 'open_group' || (row.added ?? 0) > 0
            added += row.added ?? 0
          }
        }
        appendFileSync(out, JSON.stringify({ kind: 'request', ...base, phase: p + 1, turn, index: ++index, afterOpen: sentAfterOpen, toolsAdded: sentAfterAdded, tools: toolsSent, toolsTokens: toolsSentTokens, promptTokens: reply.usage.prompt_tokens, cachedTokens: reply.usage.prompt_tokens_details?.cached_tokens ?? 0, completionTokens: reply.usage.completion_tokens, ttftMs: reply.ttftMs, totalMs: reply.totalMs, retries: reply.retries, finish: reply.finish, calls: rows, text: reply.content }) + '\n')
        if (reply.toolCalls.length === 0) break
      }
      done.push(phase.done(phaseCalls))
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught)
  }
  appendFileSync(out, JSON.stringify({ kind: 'session', ...base, requests: index, opened: session.opened, done, error, messages }) + '\n')
  console.error(`${arm} ${model.replace(/^.*\//, '')} ${scenario.id} #${sample}: ${error ? `ERROR ${error.slice(0, 120)}` : done.map((d) => (d ? '✓' : '✗')).join('')} ${index} requests, opened ${session.opened.join(',') || '-'}`)
}

const jobs = models.flatMap((model) => scenarios.flatMap((scenario) => Array.from({ length: samples }, (_, i) => i + 1).filter((n) => !onlySamples || onlySamples.includes(n)).map((n) => () => runSession(model, scenario, n))))
await Promise.all(Array.from({ length: Math.max(1, parallel) }, async () => { for (let job = jobs.shift(); job; job = jobs.shift()) await job() }))
await client.close()
console.error(`rows: ${out}`)
