// Asks whether the Gemini Interactions API keeps its implicit cache when tools are loaded mid-conversation with Tool Retrieval
// (aistudio.google.com/docs/tool-retrieval). Three arms, each a model-driven loop over the same two user turns:
//   client: a client-executed `tool_search` named open_group, answered by a function_result carrying the group's schemas.
//   server: Google's hosted `tool_search` over every kv and d1 tool sent with defer_loading.
//   control: open_group as a plain function, with the group's tools appended to `tools` after it is called.
// Requests are stateless (store: false) and carry the whole history, echoing model steps as received.
// After each load the same request is sent again. Each line prints total input, cached and tool-use tokens and the steps.
// Usage: tsx scripts/agent-probe-gemini.ts [--models gemini-4-hydrogen,...] [--arms client,server,control] [--wait ms] [--env <.env path>]
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import * as z from 'zod/v4'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const envFile = opt('env')
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}
const token = process.env.GEMINI_API_KEY
if (!token) throw new Error('GEMINI_API_KEY is not set')
const wait = Number(opt('wait', '3000'))
const models = opt('models', 'gemini-4-hydrogen')!.split(',')
const arms = opt('arms', 'client,server,control')!.split(',')

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const group = async (name: string) => ((await client.request({ method: 'groups/get', params: { name } }, z.looseObject({}))) as { tools: McpTool[] }).tools
const groups: Record<string, McpTool[]> = { 'kv-api': await group('kv-api'), 'd1-api': await group('d1-api') }
await client.close()

// Gemini rejects `$ref` into `$defs` inside a function_result, so references are inlined in every arm.
const inline = (node: unknown, defs: Record<string, unknown>, depth = 0): unknown => {
  if (Array.isArray(node)) return node.map((item) => inline(item, defs, depth))
  if (!node || typeof node !== 'object') return node
  const { $ref, $defs, $schema, ...rest } = node as Record<string, unknown>
  if (typeof $ref === 'string' && depth < 8) return inline(defs[$ref.replace('#/$defs/', '')], defs, depth + 1)
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, inline(value, defs, depth)]))
}
const params = (tool: McpTool) => {
  const schema = tool.inputSchema ?? { type: 'object', properties: {} }
  return inline(schema, (schema.$defs ?? {}) as Record<string, unknown>)
}
const decl = (tool: McpTool) => ({ type: 'function', name: tool.name, description: tool.description ?? '', parameters: params(tool) })
const nameParam = { type: 'object', properties: { name: { type: 'string', description: 'kv-api or d1-api' } }, required: ['name'] }
const openGroup = (id: string) => ({ type: 'function', name: 'open_group', description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, parameters: nameParam })
const clientSearch = (id: string) => ({ type: 'tool_search', execution: 'client', name: 'open_group', description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, parameters: nameParam })

const filler = Array.from({ length: 1500 }, (_, i) => createHash('sha256').update(`pad-${i}`).digest('hex').slice(0, 6)).join(' ')
const system = (id: string, how: string) => `Probe ${id}. You are connected to an MCP server whose tools are dry runs. The account id is demo. Use the tools and do not ask questions. ${how} Groups: kv-api (key-value store), d1-api (SQL databases).\n\nNotes with no information in them: ${filler}`
const userTurns = ['In the key-value namespace with id demo-kv, list the keys that begin with session:.', 'Now list the D1 databases in the account.']
const userInput = (text: string) => ({ type: 'user_input', content: [{ type: 'text', text }] })

type Step = { type: string; id?: string; name?: string; arguments?: Record<string, unknown>; content?: { text?: string }[] }
type Reply = { steps: Step[]; line: string } | { error: string }

async function ask(model: string, systemInstruction: string, tools: unknown[], input: unknown[]): Promise<Reply> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': token!, 'content-type': 'application/json' },
    body: JSON.stringify({ model, store: false, system_instruction: systemInstruction, generation_config: { max_output_tokens: 800 }, tools, input })
  })
  const text = await response.text()
  await new Promise((resolve) => setTimeout(resolve, wait))
  if (!response.ok) return { error: `HTTP ${response.status} ${text.replace(/\s+/g, ' ').slice(0, 600)}` }
  const parsed = JSON.parse(text) as { steps?: Step[]; outputs?: Step[]; usage?: Record<string, number> }
  const steps = parsed.steps ?? parsed.outputs ?? []
  const shown = steps
    .filter((step) => step.type !== 'thought')
    .map((step) => (step.type === 'function_call' ? `function_call ${step.name}` : step.type === 'tool_search_call' ? `tool_search_call ${JSON.stringify(step.arguments)}` : step.type === 'model_output' ? `model_output ${JSON.stringify((step.content?.[0]?.text ?? '').slice(0, 80))}` : step.type))
  const usage = parsed.usage ?? {}
  return { steps, line: `input ${usage.total_input_tokens}, cached ${usage.total_cached_tokens ?? 0}, tool_use ${usage.total_tool_use_tokens ?? 0}, steps ${shown.join('; ') || 'none'}` }
}

// The client arm loads into the history, the control arm into `tools`, the server arm leaves loading to the API.
async function run(model: string, arm: string) {
  const id = randomUUID()
  let tools: unknown[] =
    arm === 'client' ? [clientSearch(id)] : arm === 'server' ? [{ type: 'tool_search' }, ...[...groups['kv-api']!, ...groups['d1-api']!].map((tool) => ({ ...decl(tool), defer_loading: true }))] : [openGroup(id)]
  const how = arm === 'server' ? 'Search for a tool before using it.' : 'Open a group before using its tools.'
  const instruction = system(id, how)
  const history: unknown[] = []
  const label = (text: string) => `  ${arm.padEnd(8)}${text.padEnd(44)}`
  for (const [turn, text] of userTurns.entries()) {
    history.push(userInput(text))
    for (let request = 0; request < 6; request++) {
      const reply = await ask(model, instruction, tools, history)
      if ('error' in reply) return console.log(label(`turn ${turn + 1} request ${request + 1}`) + reply.error)
      console.log(label(`turn ${turn + 1} request ${request + 1}`) + reply.line)
      if (turn === 0 && request === 0) {
        const again = await ask(model, instruction, tools, history)
        console.log(label('  the same request again') + ('error' in again ? again.error : again.line))
      }
      history.push(...reply.steps)
      const calls = reply.steps.filter((step) => step.type === 'function_call')
      if (calls.length === 0) break
      let loaded = false
      for (const call of calls) {
        const name = String(call.arguments?.name ?? '')
        if (call.name === 'open_group' && groups[name]) {
          loaded = true
          if (arm === 'client') history.push({ type: 'function_result', name: 'open_group', call_id: call.id, result: groups[name].map(decl) })
          else {
            tools = [...tools, ...groups[name].map(decl)]
            history.push({ type: 'function_result', name: 'open_group', call_id: call.id, result: [{ type: 'text', text: `Opened '${name}'.` }] })
          }
        } else history.push({ type: 'function_result', name: call.name, call_id: call.id, result: [{ type: 'text', text: '{"dryRun":true}' }] })
      }
      if (loaded) {
        const after = await ask(model, instruction, tools, history)
        console.log(label('  after the load') + ('error' in after ? after.error : after.line))
        const again = await ask(model, instruction, tools, history)
        console.log(label('  the same request again') + ('error' in again ? again.error : again.line))
        if ('error' in after) return
        history.push(...after.steps)
        const next = after.steps.filter((step) => step.type === 'function_call')
        if (next.length === 0) break
        for (const call of next) history.push({ type: 'function_result', name: call.name, call_id: call.id, result: [{ type: 'text', text: '{"dryRun":true}' }] })
      }
    }
  }
}

for (const model of models) {
  console.log(model)
  for (const arm of arms) await run(model, arm)
}
