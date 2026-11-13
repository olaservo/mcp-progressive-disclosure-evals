// Asks whether a hosted endpoint honours the mid-session tool paths in two open models' public chat templates:
// GLM-5.3 Flash skips a tool marked `defer_loading` and renders it when a tool result carries a `tool_reference`;
// DeepSeek V4.1 Flash renders `tools` attached to a later system message. Each line prints the provider's prompt
// token count, which shows whether the 13 kv-api schemas (about 4k tokens) were rendered, and the model's tool calls.
// Usage: tsx scripts/agent-probe.ts [--env <.env path>]
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import * as z from 'zod/v4'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const envFile = args.includes('--env') ? args[args.indexOf('--env') + 1] : undefined
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}
const tokenFile = join(homedir(), '.cache', 'huggingface', 'token')
const token = process.env.HF_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : undefined)

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const kv = ((await client.request({ method: 'groups/get', params: { name: 'kv-api' } }, z.looseObject({}))) as { tools: McpTool[] }).tools
await client.close()

const asFn = (tool: McpTool, extra: Record<string, unknown> = {}) => ({ type: 'function', function: { name: tool.name, description: tool.description ?? '', parameters: tool.inputSchema, ...extra } })
const openGroup = { type: 'function', function: { name: 'open_group', description: 'Open a capability group by name. Makes its tools callable.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } }
const system = { role: 'system', content: `Probe ${Math.random()}. You are connected to an MCP server whose tools are dry runs. The account id is demo. Use the tools and do not ask questions. Groups: kv-api (key-value store).` }
const user = { role: 'user', content: 'In the key-value namespace with id demo-kv, list the keys that begin with session:.' }
const opened = { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'open_group', arguments: '{"name":"kv-api"}' } }] }
const result = (content: unknown) => ({ role: 'tool', tool_call_id: 'call_1', content })

async function ask(model: string, body: Record<string, unknown>): Promise<string> {
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1' },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 600, chat_template_kwargs: { enable_thinking: false }, ...body })
  })
  const text = await response.text()
  if (!response.ok) return `HTTP ${response.status} ${text.replace(/\s+/g, ' ').slice(0, 240)}`
  const parsed = JSON.parse(text) as { choices: { message: { tool_calls?: { function: { name: string } }[] } }[]; usage: { prompt_tokens: number } }
  return `prompt tokens ${parsed.usage.prompt_tokens}, calls ${parsed.choices[0]!.message.tool_calls?.map((call) => call.function.name).join(',') ?? 'none'}`
}

const GLM = 'zai-org/GLM-5.3-Flash:baseten'
const DEEPSEEK = 'deepseek-ai/DeepSeek-V4.1-Flash:baseten'
const deferred = kv.map((tool) => asFn(tool, { defer_loading: true }))
console.log(`${GLM}`)
console.log(`  open_group only:                         ${await ask(GLM, { tools: [openGroup], messages: [system, user] })}`)
console.log(`  13 tools marked defer_loading:           ${await ask(GLM, { tools: [openGroup, ...deferred], messages: [system, user] })}`)
console.log(`  the same, tool result of tool_reference: ${await ask(GLM, { tools: [openGroup, ...deferred], messages: [system, user, opened, result(kv.map((tool) => ({ type: 'tool_reference', name: tool.name })))] })}`)
console.log(`  13 tools resident after the open:        ${await ask(GLM, { tools: [openGroup, ...kv.map((tool) => asFn(tool))], messages: [system, user, opened, result("Opened 'kv-api'.")] })}`)
console.log(`${DEEPSEEK}`)
console.log(`  open_group only:                         ${await ask(DEEPSEEK, { tools: [openGroup], messages: [system, user] })}`)
console.log(`  13 tools on a later system message:      ${await ask(DEEPSEEK, { tools: [openGroup], messages: [system, user, opened, result("Opened 'kv-api'."), { role: 'system', content: 'The tools of kv-api are now available.', tools: kv.map((tool) => asFn(tool)) }] })}`)
console.log(`  13 tools resident after the open:        ${await ask(DEEPSEEK, { tools: [openGroup, ...kv.map((tool) => asFn(tool))], messages: [system, user, opened, result("Opened 'kv-api'.")] })}`)
