// Asks models which group, skill or tool they would load for a task, given only what a client sees before groups/get.
// Every mode shows the server's skills/list index, since a Skills-extension client would show it too.
// Usage: tsx scripts/select.ts --url <mcp url> [--mode groups|flat|flat-schemas] [--tasks v1|v2] [--models a,b,c] [--seeds N] [--limit N] [--env <.env path>] [--label name]
// Model ids route by prefix: claude-* through the Anthropic SDK, gpt-* through the OpenAI SDK, kimi-* through the OpenAI SDK
// against api.moonshot.ai, gemini-* through the Google GenAI SDK, decisions:<model> through the OpenAI Decisions API and
// jev-* through TypeSafe's System One API (both classifiers, groups mode only), and anything else through the Hugging Face
// router as <org>/<model>:<provider>.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as z from 'zod/v4'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { getEncoding } from 'js-tiktoken'

const GROUPS = 'io.modelcontextprotocol/groups'
const SKILLS = 'io.modelcontextprotocol/skills'
const Loose = z.looseObject({})
const encoding = getEncoding('o200k_base')

type Mode = 'groups' | 'flat' | 'flat-schemas'
const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const url = opt('url', 'https://pd-groups-opt2.olahungerford.workers.dev/mcp')!
let mode = opt('mode', 'groups') as Mode
let taskSet = opt('tasks', 'v1') as 'v1' | 'v2'
const models = opt('models', 'Qwen/Qwen3.5-9B:deepinfra,Qwen/Qwen3-14B:deepinfra,claude-opus-5-5')!.split(',')
const seeds = Number(opt('seeds', taskSet === 'v2' ? '1' : '5'))
const limit = Number(opt('limit', '0'))
const label = opt('label', mode)!
const envFile = opt('env')
// --replay <jsonl> re-prints the summary from a finished run without calling any model.
const replay = opt('replay')

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

/**
 * `full` adds answers that are also right in the 3,036-tool catalog, whose 139 groups cover products the subset lacks.
 * `skills` are skill names accepted in every mode beyond the workflow skills whose names are already in `groups`.
 */
type Task = { task: string; groups: string[]; tools: string[]; skills?: string[]; full?: { groups?: string[]; tools?: string[] } }

/** Tasks with the answers that count as correct. `groups` is for groups mode, `tools` are name prefixes for flat modes. */
const TASKS_V1: Task[] = [
  { task: 'Add Turnstile bot protection to our signup form and verify the tokens on the server.', groups: ['turnstile-spin', 'turnstile-api'], tools: ['turnstile_'] },
  { task: 'Our Turnstile secret key leaked in a public repo. Rotate it.', groups: ['turnstile-spin', 'turnstile-api'], tools: ['turnstile_widgets_rotateSecret'] },
  { task: 'Which Durable Object namespaces exist in this account, and which objects in them hold storage?', groups: ['durable-objects', 'durable-objects-api'], tools: ['durableObjects_'] },
  { task: 'Forward mail sent to support@example.com to our helpdesk address.', groups: ['cloudflare-email-service', 'email-routing-api'], tools: ['emailRouting_'] },
  { task: 'Set up a sending subdomain so our Worker can send transactional email.', groups: ['cloudflare-email-service', 'email-sending-api'], tools: ['emailSending_'] },
  { task: 'Create a new D1 database for the staging environment.', groups: ['d1-api'], tools: ['d1_create'] },
  { task: 'Delete every key under the prefix "session:" in a KV namespace.', groups: ['kv-api'], tools: ['kv_'] },
  { task: 'Set CORS rules on the uploads R2 bucket.', groups: ['r2-api'], tools: ['r2_buckets_cors'] },
  { task: 'Add a consumer to the orders queue.', groups: ['queues-api'], tools: ['queues_consumers'] },
  { task: 'Upload a new version of the api Worker script and deploy it.', groups: ['workers-api'], tools: ['workers_'], skills: ['wrangler'] },
  { task: 'List the running instances of our container application.', groups: ['containers-api'], tools: ['containers_'] },
  { task: 'Review our Durable Object class for alarm handling bugs.', groups: ['durable-objects', 'durable-objects-api'], tools: ['durableObjects_'] },
  { task: 'Enable Email Routing on the zone and check its DNS records.', groups: ['cloudflare-email-service', 'email-routing-api'], tools: ['emailRouting_'] },
  { task: "What's the recommended structure for a Worker's fetch handler?", groups: ['none'], tools: ['none'], skills: ['workers-best-practices'] }
]

/** The second set describes the job without naming the product, with confusable pairs that have one right answer. */
const TASKS_V2: Task[] = [
  { task: 'Add a bot check to our signup form and verify the challenge result on the server before accepting the submission.', groups: ['turnstile-spin', 'turnstile-api'], tools: ['turnstile_'] },
  { task: "The server-side secret that validates our signup form's bot challenge was committed to a public repo. Rotate it.", groups: ['turnstile-spin', 'turnstile-api'], tools: ['turnstile_widgets_rotateSecret'] },
  { task: 'Forward everything sent to billing@ at our domain to a Gmail inbox.', groups: ['cloudflare-email-service', 'email-routing-api'], tools: ['emailRouting_'] },
  { task: 'Set up a sender address so our edge function can email order receipts after checkout.', groups: ['cloudflare-email-service', 'email-sending-api'], tools: ['emailSending_'] },
  { task: 'Check whether the DNS records for our outbound mail subdomain have verified, and fix them if not.', groups: ['cloudflare-email-service', 'email-sending-api'], tools: ['emailSending_subdomains_dns'], full: { groups: ['dns-api', 'email-auth-api', 'email-domains-api'], tools: ['dns_records', 'emailAuth_', 'emailDomains_'] } },
  { task: 'Build a per-chat-room state holder that serializes writes and wakes itself once an hour.', groups: ['durable-objects', 'durable-objects-api'], tools: ['durableObjects_'] },
  { task: 'Which of our stateful object classes have instances that currently hold stored data?', groups: ['durable-objects', 'durable-objects-api'], tools: ['durableObjects_'] },
  { task: 'Review our stateful coordination class for alarm-handling bugs.', groups: ['durable-objects'], tools: ['durableObjects_'] },
  { task: 'Process image-resize jobs in the background, retrying any job that fails.', groups: ['queues-api'], tools: ['queues_'], full: { groups: ['workflows-api'], tools: ['workflows_'] } },
  { task: 'Add a dead-letter destination for messages that fail repeatedly on the orders pipeline.', groups: ['queues-api'], tools: ['queues_'] },
  { task: 'Serve 50 GB of user uploads to browsers on another origin, so cross-origin headers are needed.', groups: ['r2-api'], tools: ['r2_'] },
  { task: 'Expire files under tmp/ in our object store after 7 days.', groups: ['r2-api'], tools: ['r2_buckets_lifecycle'] },
  { task: 'Store small read-heavy feature flags at the edge. Eventual consistency is fine.', groups: ['kv-api'], tools: ['kv_'], full: { groups: ['flagship-api'], tools: ['flagship_'] } },
  { task: 'Remove every entry whose key begins with "session:" from the edge key-value store.', groups: ['kv-api'], tools: ['kv_'] },
  { task: 'We need relational tables with SQL joins for orders, serverless, with no connection pooling to manage.', groups: ['d1-api'], tools: ['d1_'] },
  { task: 'Push a new build of our edge function and make it live.', groups: ['workers-api'], tools: ['workers_'], skills: ['wrangler'], full: { groups: ['workers-builds-api', 'builds-api'], tools: ['workersBuilds_', 'builds_'] } },
  { task: 'Run our edge function every night at 02:00.', groups: ['workers-api'], tools: ['workers_scripts_schedules'], skills: ['wrangler'] },
  { task: 'Run our Docker image at the edge and show the running instances.', groups: ['containers-api'], tools: ['containers_'] },
  { task: "What is the recommended structure for an edge function's fetch handler?", groups: ['none'], tools: ['none'], skills: ['workers-best-practices'] },
  // No fit in the subset. The full catalog has accounts_tokens_roll and user_tokens_roll.
  { task: 'Rotate the account API token our deployment pipeline uses.', groups: ['none'], tools: ['none'], full: { groups: ['accounts-api', 'user-api'], tools: ['accounts_tokens', 'user_tokens'] } }
]
const taskSets = { v1: TASKS_V1, v2: TASKS_V2 }
const tasks = limit > 0 ? taskSets[taskSet].slice(0, limit) : taskSets[taskSet]

/** The accepted answers for a task against the catalog the header describes. A `none` entry drops out once the full catalog gives the task a fit. */
function expectedFor(task: Task, header: { tools: number; groups: number }): string[] {
  const full = header.groups > 20 || header.tools > 1000
  const base = mode === 'groups' ? task.groups : task.tools
  const extra = full ? ((mode === 'groups' ? task.full?.groups : task.full?.tools) ?? []) : []
  const primitives = extra.length > 0 ? [...base.filter((e) => e !== 'none'), ...extra] : base
  // A skill is accepted where its workflow group is (they share a name), plus the task's own `skills`.
  const skills = [...task.groups.filter(isSkillGroup), ...(task.skills ?? [])]
  return [...primitives, ...skills.map((name) => `skill:${name}`)]
}
const SKILL_PREFIX = 'skill:'
const isSkillEntry = (entry: string) => entry.startsWith(SKILL_PREFIX)

type Named = { name: string; description?: string }
const firstLine = (text = '') => text.split('\n')[0]!.trim()

/** Models whose provider context is too small for a prompt are skipped, with a note. */
const MAX_CONTEXT: Record<string, number> = { 'Qwen/Qwen3-14B:deepinfra': 40960 }

/** The lowest reasoning setting each vendor allows, recorded in the results header. */
function reasoning(model: string): string {
  if (model.startsWith('claude-')) return 'effort low'
  if (model.startsWith('decisions:')) return 'decisions api, choice question'
  if (model.startsWith('jev-')) return 'system one api, choice question'
  if (model.startsWith('gpt-')) return `reasoning_effort ${openaiEffort(model)}`
  if (model.startsWith('kimi-')) return 'reasoning_effort low'
  if (model.startsWith('gemini-')) return `thinking_level ${geminiLevel(model)}`
  return 'enable_thinking false, temperature 0.2, seeded'
}
const openaiEffort = (model: string) => (/terra|luna/.test(model) ? 'none' : 'low')
const geminiLevel = (model: string) => (model.startsWith('gemini-3.6') ? 'minimal' : 'low')

// What the model sees. In groups mode: top-level tools plus groups/list. In flat mode: every tool's name and first line.
// In flat-schemas mode: the full tools/list result as compact JSON, which is what a flat server actually sends.
// Every mode adds the skills/list index when the server declares the Skills extension (Option 3 serves none).
async function catalog(): Promise<{ text: string; instruction: string; groups: Named[]; skills: Named[]; tools: string[] }> {
  const client = new Client({ name: 'groups-select', version: '0.1.0' }, { capabilities: { extensions: { [GROUPS]: {}, [SKILLS]: {} } }, versionNegotiation: { mode: 'auto' } })
  await client.connect(new StreamableHTTPClientTransport(new URL(url)))
  const caps = client.getServerCapabilities() ?? {}
  const tools = (await client.listTools()).tools
  const lines =
    mode === 'flat-schemas'
      ? ['Tools (the tools/list result):', JSON.stringify({ tools })]
      : ['Top-level tools (callable now):', ...tools.map((tool) => `- ${tool.name}: ${firstLine(tool.description)}`)]
  let groups: Named[] = []
  // Option 3 serves renamed groups under the Skills identifier, so its skills/list is not a SEP-2640 index.
  const noun = caps.extensions?.[GROUPS] !== undefined ? 'groups' : 'skills'
  if (mode === 'groups') {
    groups = ((await client.request({ method: `${noun}/list`, params: {} }, Loose)) as Record<string, Named[]>)[noun]!
    lines.push('', `Groups (a group's tools and instructions load on demand with ${noun}/get):`, ...groups.map((group) => `- ${group.name}: ${firstLine(group.description)}`))
  }
  let skills: Named[] = []
  if (caps.extensions?.[SKILLS] !== undefined) {
    // SEP-2640 entries carry `frontmatter`; Option 3's renamed groups under the same identifier do not, and drop out.
    type Entry = { frontmatter?: { name: string; description?: string } }
    const entries = ((await client.request({ method: 'skills/list', params: {} }, Loose)) as { skills?: Entry[] }).skills ?? []
    skills = entries.flatMap((entry) => (entry.frontmatter ? [{ name: entry.frontmatter.name, description: entry.frontmatter.description }] : []))
    if (skills.length > 0) lines.push('', 'Skills (instructions that load on demand with skills/get and resources/read):', ...skills.map((skill) => `- ${skill.name}: ${firstLine(skill.description)}`))
  }
  await client.close()
  const skillClause = skills.length > 0 ? ' {"skill":"<name>"} to load one skill,' : ''
  const instruction =
    mode === 'groups'
      ? `Reply with {"group":"<name>"} to load one group,${skillClause} {"tool":"<name>"} to call a top-level tool, or {"none":true} if nothing listed fits.`
      : `Reply with {"tool":"<name>"} for the tool you would call first,${skillClause} or {"none":true} if nothing listed fits.`
  return { text: lines.join('\n'), instruction, groups, skills, tools: tools.map((tool) => tool.name) }
}

const SYSTEM = 'You are an agent connected to an MCP server. Decide where to look first for the capability a task needs. Reply with one JSON object and nothing else.'

type Answer = { raw: string; group?: string; tool?: string; skill?: string; none?: boolean; inputTokens?: number; outputTokens?: number; cacheRead?: number }

function parse(raw: string): Answer {
  const text = raw.replace(/```(?:json)?/g, '').trim()
  const match = /\{[\s\S]*\}/.exec(text)
  try {
    const value = JSON.parse(match?.[0] ?? text) as Record<string, unknown>
    const str = (key: string) => (typeof value[key] === 'string' ? (value[key] as string) : undefined)
    return { raw, group: str('group'), tool: str('tool'), skill: str('skill'), none: value.none === true }
  } catch {
    return { raw }
  }
}

async function askHf(model: string, catalogText: string, task: string, instruction: string, seed: number): Promise<Answer> {
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${hfToken()}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${catalogText}\n\nTask: ${task}\n${instruction}` }
      ],
      temperature: 0.2,
      seed,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false }
    })
  })
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)
  const body = (await response.json()) as { choices: { message: { content: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } | null } }
  return { ...parse(body.choices[0]?.message.content ?? ''), inputTokens: body.usage?.prompt_tokens, outputTokens: body.usage?.completion_tokens, cacheRead: body.usage?.prompt_tokens_details?.cached_tokens ?? 0 }
}

let anthropic: Anthropic | undefined
async function askClaude(model: string, catalogText: string, task: string, instruction: string): Promise<Answer> {
  anthropic ??= new Anthropic()
  // The catalog is the same for every call, so it sits in its own cached block and the task follows it.
  const response = await anthropic.beta.messages.create({
    model,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: catalogText, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `Task: ${task}\n${instruction}` }
        ]
      }
    ]
  })
  if (response.stop_reason === 'refusal') return { raw: 'refusal' }
  const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('')
  return { ...parse(text), inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cacheRead: response.usage.cache_read_input_tokens ?? 0 }
}

const openaiClients = new Map<string, OpenAI>()
function openaiClient(model: string): OpenAI {
  const key = model.startsWith('kimi-') ? 'kimi' : 'openai'
  let client = openaiClients.get(key)
  if (!client) {
    client = key === 'kimi' ? new OpenAI({ apiKey: process.env.MOONSHOT_API_KEY, baseURL: 'https://api.moonshot.ai/v1' }) : new OpenAI()
    openaiClients.set(key, client)
  }
  return client
}

// OpenAI and Kimi through chat completions. Reasoning models reject sampling parameters, so none are sent;
// the catalog is the shared prefix, so prompt caching applies on its own.
async function askOpenAI(model: string, catalogText: string, task: string, instruction: string): Promise<Answer> {
  const response = await openaiClient(model).chat.completions.create({
    model,
    reasoning_effort: model.startsWith('kimi-') ? 'low' : openaiEffort(model),
    max_completion_tokens: 4000,
    response_format: { type: 'json_object' },
    prompt_cache_key: `groups-select-${label}`,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `${catalogText}\n\nTask: ${task}\n${instruction}` }
    ]
  })
  const choice = response.choices[0]
  if (choice?.message.refusal) return { raw: `refusal: ${choice.message.refusal}` }
  return { ...parse(choice?.message.content ?? ''), inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens, cacheRead: response.usage?.prompt_tokens_details?.cached_tokens ?? 0 }
}

/**
 * The classifiers' choices: every group by name, the skills whose names are not already a group as `skill:<name>`,
 * and none. A pick is read back into a group or skill answer.
 */
function choicesFor(groups: Named[], skills: Named[]): { value: string; description: string }[] {
  const groupNames = new Set(groups.map((group) => group.name))
  return [
    ...groups.map((group) => ({ value: group.name, description: firstLine(group.description) })),
    ...skills.filter((skill) => !groupNames.has(skill.name)).map((skill) => ({ value: `${SKILL_PREFIX}${skill.name}`, description: `Skill: ${firstLine(skill.description)}` })),
    { value: 'none', description: 'Nothing listed fits the task.' }
  ]
}
function fromChoice(pick: string): Pick<Answer, 'group' | 'skill' | 'none'> {
  if (pick === 'none') return { none: true }
  return isSkillEntry(pick) ? { skill: pick.slice(SKILL_PREFIX.length), none: false } : { group: pick, none: false }
}
const CLASSIFIER_CONTEXT = 'An agent is connected to an MCP server whose tools are organised into groups, with skills beside them. Each group or skill loads on demand.'
const CLASSIFIER_QUESTION = 'Which group or skill should the agent load first for this task? Choose none if nothing fits.'

// The Decisions API answers a choice question with probabilities and no generated text. Only the task goes in the input.
async function askDecisions(model: string, groups: Named[], skills: Named[], task: string): Promise<Answer> {
  const response = await openaiClient(model).decisions.create({
    model,
    input: [
      { role: 'system', content: CLASSIFIER_CONTEXT },
      { role: 'user', content: `Task: ${task}` }
    ],
    questions: [{ type: 'choice', name: 'group', instructions: CLASSIFIER_QUESTION, choices: choicesFor(groups, skills) }]
  })
  const answer = response.answers[0]
  if (!answer || answer.type !== 'choice') return { raw: JSON.stringify(answer ?? null), inputTokens: response.usage.input_tokens }
  const top = [...answer.probabilities].sort((a, b) => b.probability - a.probability).slice(0, 3).map((p) => `${String(p.value)}=${p.probability.toFixed(3)}`)
  return { raw: top.join(' '), ...fromChoice(String(answer.choice)), inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, cacheRead: response.usage.input_tokens_details.cached_tokens }
}

// TypeSafe's Jev answers the same choice question through its System One endpoint. The criteria map is value to description.
async function askJev(model: string, groups: Named[], skills: Named[], task: string): Promise<Answer> {
  const criteria = Object.fromEntries(choicesFor(groups, skills).map((choice) => [choice.value, choice.description]))
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1' },
    body: JSON.stringify({
      state: `${CLASSIFIER_CONTEXT}\n\nTask: ${task}`,
      model,
      questions: { group: { type: 'choice', instructions: CLASSIFIER_QUESTION, criteria } }
    })
  })
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)
  const body = (await response.json()) as { model?: string; answers: { group?: { choice: string; confidence: number; probabilities: Record<string, number> } }; usage?: { input_tokens?: number; output_tokens?: number } }
  const answer = body.answers.group
  if (!answer) return { raw: JSON.stringify(body.answers).slice(0, 200), inputTokens: body.usage?.input_tokens }
  const top = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, p]) => `${name}=${p.toFixed(3)}`)
  return { raw: `${body.model ?? model} ${top.join(' ')}`, ...fromChoice(answer.choice), inputTokens: body.usage?.input_tokens, outputTokens: body.usage?.output_tokens, cacheRead: 0 }
}

let gemini: GoogleGenAI | undefined
async function askGemini(model: string, catalogText: string, task: string, instruction: string, seed: number): Promise<Answer> {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  const response = await gemini.models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: catalogText }, { text: `Task: ${task}\n${instruction}` }] }],
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.2,
      seed,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: geminiLevel(model) === 'minimal' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW }
    }
  })
  const usage = response.usageMetadata
  return { ...parse(response.text ?? ''), inputTokens: usage?.promptTokenCount, outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0), cacheRead: usage?.cachedContentTokenCount ?? 0 }
}

async function ask(model: string, text: string, groups: Named[], skills: Named[], task: string, instruction: string, seed: number): Promise<Answer> {
  if (model.startsWith('claude-')) return askClaude(model, text, task, instruction)
  if (model.startsWith('decisions:') || model.startsWith('jev-')) {
    if (mode !== 'groups') throw new Error(`${model} is a classifier and runs in groups mode only`)
    return model.startsWith('jev-') ? askJev(model, groups, skills, task) : askDecisions(model.slice('decisions:'.length), groups, skills, task)
  }
  if (model.startsWith('gpt-') || model.startsWith('kimi-')) return askOpenAI(model, text, task, instruction)
  if (model.startsWith('gemini-')) return askGemini(model, text, task, instruction, seed)
  return askHf(model, text, task, instruction, seed)
}

interface Trial {
  model: string
  seed: number
  task: string
  expected: string[]
  answer: Answer
  pick: string
  /** The pick is right and under the right key. */
  correct: boolean
  /** The right name, under either key. Small models often return a group name as {"tool": ...}. */
  rightName: boolean
}

/**
 * `expected` holds primitive answers (group names, or tool-name prefixes in flat modes) and `skill:<name>` entries.
 * A skill answer is right when its name is among the skill entries; a group or tool answer when it is among the rest.
 */
function score(answer: Answer, expected: string[]): { correct: boolean; rightName: boolean } {
  const primitives = expected.filter((entry) => !isSkillEntry(entry))
  const skills = expected.filter(isSkillEntry).map((entry) => entry.slice(SKILL_PREFIX.length))
  const hits = (value: string | undefined) => value !== undefined && (mode === 'groups' ? primitives.includes(value) : primitives.some((prefix) => value.startsWith(prefix)))
  const noneOk = answer.none === true && primitives.includes('none')
  const skillOk = answer.skill !== undefined && skills.includes(answer.skill)
  const keyed = mode === 'groups' ? answer.group : answer.tool
  return { correct: hits(keyed) || skillOk || noneOk, rightName: hits(answer.group) || hits(answer.tool) || skillOk || noneOk }
}

interface Header { mode: string; taskSet?: string; url: string; tools: number; groups: number; skills?: number; promptTokens: number; tasks: number; seeds: number; reasoning?: Record<string, string> }

const shortName = (model: string) => model.replace(/^.*\//, '').replace(/:.*$/, '')
const isSkillGroup = (name: string) => !name.endsWith('-api') && name !== 'none'
const pickOf = (answer: Answer) => (answer.group ? `group:${answer.group}` : answer.skill ? `skill:${answer.skill}` : answer.tool ? `tool:${answer.tool}` : answer.none ? 'none' : 'unparsed')

function summary(header: Header, trials: Trial[], out: string): void {
  const modelsSeen = [...new Set(trials.map((t) => t.model))]
  console.log(`\n${header.mode} mode, task set ${header.taskSet ?? 'v1'}, ${header.url}. ${header.tools} top-level tools, ${header.groups} groups, ${header.skills ?? 0} skills listed, ${header.promptTokens} prompt tokens (o200k_base) before the task. ${header.tasks} tasks x ${header.seeds} samples.\n`)
  console.log('| Model | Reasoning | Correct | Right name, either key | Picked a group | Picked a skill | None | Unparsed or error | Avg input tokens | Cache read |')
  console.log('| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: |')
  for (const model of modelsSeen) {
    const mine = trials.filter((t) => t.model === model)
    const withUsage = mine.filter((t) => t.answer.inputTokens)
    const avgIn = Math.round(withUsage.reduce((sum, t) => sum + (t.answer.inputTokens ?? 0), 0) / Math.max(1, withUsage.length))
    const cached = mine.reduce((sum, t) => sum + (t.answer.cacheRead ?? 0), 0)
    const setting = header.reasoning?.[model] ?? (model.startsWith('claude-') ? 'effort low' : 'enable_thinking false, temperature 0.2, seeded')
    console.log(`| ${model} | ${setting} | ${mine.filter((t) => t.correct).length}/${mine.length} | ${mine.filter((t) => t.rightName).length}/${mine.length} | ${mine.filter((t) => t.answer.group).length} | ${mine.filter((t) => t.answer.skill).length} | ${mine.filter((t) => t.answer.none).length} | ${mine.filter((t) => t.pick === 'unparsed').length} | ${avgIn} | ${cached} |`)
  }

  // Every model's pick per task. A wrong pick is prefixed MISS; a right name under the wrong key ends in *.
  const taskOrder = [...new Set(trials.map((t) => t.task))]
  console.log('\nPicks by task:\n')
  console.log(`| Task | Expected | ${modelsSeen.map(shortName).join(' | ')} |`)
  console.log(`| :-- | :-- | ${modelsSeen.map(() => ':--').join(' | ')} |`)
  for (const task of taskOrder) {
    const expected = trials.find((t) => t.task === task)!.expected.join(' / ')
    const cells = modelsSeen.map((model) => {
      const counts = new Map<string, number>()
      for (const t of trials.filter((t) => t.model === model && t.task === task)) {
        const cell = t.correct ? t.pick.replace(/^group:/, '') : `MISS ${t.pick}${t.rightName ? '*' : ''}`
        counts.set(cell, (counts.get(cell) ?? 0) + 1)
      }
      return [...counts].map(([cell, n]) => (n > 1 ? `${cell} x${n}` : cell)).join(', ') || '-'
    })
    console.log(`| ${task} | ${expected} | ${cells.join(' | ')} |`)
  }

  // Where a task accepts both a skill's workflow group and a product's API group, which one each model took.
  // A `skill` answer naming the workflow skill counts with the skill group.
  const primitivesOf = (t: Trial) => t.expected.filter((e) => !isSkillEntry(e))
  const both = trials.filter((t) => t.correct && primitivesOf(t).length === 2 && primitivesOf(t).some(isSkillGroup) && primitivesOf(t).some((e) => e.endsWith('-api')))
  if (both.length > 0) {
    console.log('\nTasks that accept either the skill group or the API group, correct answers only:')
    for (const model of modelsSeen) {
      const mine = both.filter((t) => t.model === model)
      if (mine.length === 0) continue
      const skill = mine.filter((t) => (t.answer.group !== undefined && isSkillGroup(t.answer.group)) || t.answer.skill !== undefined).length
      console.log(`- ${model}: skill group ${skill}, API group ${mine.length - skill}`)
    }
  }

  console.log('\nMisses (right name under the wrong key is marked *):')
  for (const model of modelsSeen) {
    const misses = trials.filter((t) => t.model === model && !t.correct)
    if (misses.length === 0) continue
    console.log(`- ${model}:`)
    const byTask = new Map<string, string[]>()
    for (const miss of misses) byTask.set(miss.task, [...(byTask.get(miss.task) ?? []), miss.rightName ? `${miss.pick}*` : miss.pick])
    for (const [task, picks] of byTask) console.log(`  - "${task}" -> ${picks.join(', ')} (expected ${misses.find((m) => m.task === task)!.expected.join(' | ')})`)
  }
  console.log(`\nRaw trials: ${out}`)
}

if (replay) {
  const lines = readFileSync(replay, 'utf8').split('\n').filter(Boolean)
  const header = JSON.parse(lines[0]!) as Header
  mode = header.mode as Mode
  taskSet = (header.taskSet ?? 'v1') as 'v1' | 'v2'
  // Expected answers come from the task set, so a scoring change applies to old runs too.
  const byText = new Map(taskSets[taskSet].map((task) => [task.task, task]))
  const trials = lines
    .slice(1)
    .map((line) => JSON.parse(line) as Trial)
    .map((t) => {
      const task = byText.get(t.task)
      const expected = task ? expectedFor(task, header) : t.expected
      return { ...t, expected, ...score(t.answer, expected) }
    })
  summary(header, trials, replay)
} else {
  const { text, instruction, groups, skills, tools } = await catalog()
  const promptTokens = encoding.encode(`${SYSTEM}\n${text}\n${instruction}`).length
  const header: Header = { mode, taskSet, url, tools: tools.length, groups: groups.length, skills: skills.length, promptTokens, tasks: tasks.length, seeds, reasoning: Object.fromEntries(models.map((model) => [model, reasoning(model)])) }
  console.error(`${mode} mode, task set ${taskSet}, against ${url}: ${tools.length} top-level tools, ${groups.length} groups, ${skills.length} skills, ${promptTokens} prompt tokens before the task`)
  if (process.env.SELECT_DUMP_PROMPT) console.error(`--- prompt ---\n${text}\n${instruction}\n--- end ---`)

  mkdirSync('results', { recursive: true })
  const out = join('results', `${new Date().toISOString().slice(0, 10)}-${taskSet === 'v2' ? 'select2' : 'select'}-${label}.jsonl`)
  const trials: Trial[] = []
  for (const model of models) {
    const maxContext = MAX_CONTEXT[model]
    if (maxContext !== undefined && promptTokens > maxContext) {
      console.error(`${model}: skipped, ${promptTokens} prompt tokens exceed its ${maxContext} context`)
      continue
    }
    for (const entry of tasks) {
      const { task } = entry
      for (let seed = 1; seed <= seeds; seed++) {
        let answer: Answer
        try {
          answer = await ask(model, text, groups, skills, task, instruction, seed)
        } catch (error) {
          answer = { raw: `error: ${error instanceof Error ? error.message : String(error)}` }
        }
        const pick = pickOf(answer)
        const expected = expectedFor(entry, header)
        const trial: Trial = { model, seed, task, expected, answer, pick, ...score(answer, expected) }
        trials.push(trial)
        writeFileSync(out, [header, ...trials].map((t) => JSON.stringify(t)).join('\n') + '\n')
        process.stderr.write(`${model} #${seed} ${trial.correct ? 'ok  ' : 'MISS'} ${pick} <- ${task.slice(0, 50)}\n`)
      }
    }
  }
  summary(header, trials, out)
}
