// Asks whether the Messages API keeps its prompt cache when deferred tools are loaded mid-conversation, called on Anthropic's
// endpoint or through OpenRouter's Messages endpoint pinned to Anthropic. Three arms over the same scripted conversation as
// agent-probe-deferred.ts, with the kv and d1 tools sent with `defer_loading`:
//   reference: open_group's tool_result is `tool_reference` blocks (platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool,
//     Custom tool search implementation).
//   addition: open_group returns text, then a system message of `tool_addition` blocks naming the tools
//     (beta mid-conversation-tool-changes-2026-07-01).
//   control: open_group returns text and the group's tools are appended to `tools` without the flag.
// Every request uses top-level automatic caching (`cache_control` on the request), the same in all arms. Thinking is disabled.
// Each line prints input, cache_creation_input_tokens, cache_read_input_tokens and the tools called.
// Usage: tsx scripts/agent-probe-anthropic.ts [--target anthropic|openrouter] [--model id] [--provider slug] [--open-name name] [--arms reference,addition,control] [--wait ms] [--env <.env path>]
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
const target = opt('target', 'anthropic')!
const viaOpenRouter = target === 'openrouter'
const token = process.env[viaOpenRouter ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY']
if (!token) throw new Error(`${viaOpenRouter ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY'} is not set`)
const model = opt('model', viaOpenRouter ? 'anthropic/claude-haiku-5.5' : 'claude-haiku-5-5')!
const arms = opt('arms', 'reference,addition,control')!.split(',')
// OpenRouter's provider slug to pin to, for a model served by someone other than Anthropic (for example baseten).
const provider = opt('provider', 'anthropic')!
// OpenRouter wants a loaded tool named like a search tool on routes it does not treat as native.
const openName = opt('open-name', 'open_group')!
const wait = Number(opt('wait', '3000'))

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const group = async (name: string) => ((await client.request({ method: 'groups/get', params: { name } }, z.looseObject({}))) as { tools: McpTool[] }).tools
const kv = await group('kv-api')
const d1 = await group('d1-api')
await client.close()

const resident = (tool: McpTool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema ?? { type: 'object', properties: {} } })
const deferred = (tool: McpTool) => ({ ...resident(tool), defer_loading: true })
const openGroup = (id: string) => ({ name: openName, description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } })

const filler = Array.from({ length: 1500 }, (_, i) => createHash('sha256').update(`pad-${i}`).digest('hex').slice(0, 6)).join(' ')
const system = (id: string) => `Probe ${id}. You are connected to an MCP server whose tools are dry runs. The account id is demo. Use the tools and do not ask questions. Open a group before using its tools. Groups: kv-api (key-value store), d1-api (SQL databases).\n\nNotes with no information in them: ${filler}`
const user1 = { role: 'user', content: 'In the key-value namespace with id demo-kv, list the keys that begin with session:.' }
const user2 = { role: 'user', content: 'Now list the D1 databases in the account.' }
const call = (id: string, name: string, input: Record<string, unknown>) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input }] })
const result = (id: string, content: unknown) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] })
const refs = (tools: McpTool[]) => tools.map((tool) => ({ type: 'tool_reference', tool_name: tool.name }))
const addition = (tools: McpTool[]) => ({ role: 'system', content: tools.map((tool) => ({ type: 'tool_addition', tool: { type: 'tool_reference', name: tool.name } })) })

async function ask(id: string, tools: unknown[], messages: unknown[], beta?: string): Promise<string> {
  const response = await fetch(viaOpenRouter ? 'https://openrouter.ai/api/v1/messages' : 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      ...(viaOpenRouter ? { authorization: `Bearer ${token}` } : { 'x-api-key': token! }),
      'anthropic-version': '2026-10-21',
      ...(beta ? { 'anthropic-beta': beta } : {}),
      'content-type': 'application/json',
      'user-agent': 'mcp-progressive-disclosure-evals/0.1'
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      thinking: { type: 'disabled' },
      cache_control: { type: 'ephemeral' },
      system: system(id),
      ...(viaOpenRouter ? { provider: { only: [provider], allow_fallbacks: false } } : {}),
      tools,
      messages
    })
  })
  const text = await response.text()
  await new Promise((resolve) => setTimeout(resolve, wait))
  if (!response.ok) return `HTTP ${response.status} ${text.replace(/\s+/g, ' ').slice(0, 500)}`
  const parsed = JSON.parse(text) as { content?: { type: string; name?: string }[]; usage?: Record<string, number> }
  const calls = (parsed.content ?? []).filter((block) => block.type === 'tool_use').map((block) => block.name)
  const usage = parsed.usage ?? {}
  return `input ${usage.input_tokens}, cache write ${usage.cache_creation_input_tokens ?? 0}, cache read ${usage.cache_read_input_tokens ?? 0}, calls ${calls.join(',') || 'none'}`
}

const kvCall = [call('call_2', 'kv_keys_list', { account_id: 'demo', namespace_id: 'demo-kv', prefix: 'session:' }), result('call_2', '{"dryRun":true}'), { role: 'assistant', content: 'Listed.' }, user2]
console.log(`${model} via ${target}${viaOpenRouter ? ` pinned to ${provider}` : ''}, automatic caching (top-level cache_control), thinking disabled`)
for (const arm of arms) {
  const id = randomUUID()
  const all = [...kv.map(deferred), ...d1.map(deferred)]
  const label = (text: string) => `  ${arm.padEnd(10)}${text.padEnd(30)}`
  if (arm === 'reference' || arm === 'addition') {
    const tools = [openGroup(id), ...all]
    const beta = arm === 'addition' ? 'mid-conversation-tool-changes-2026-07-01' : undefined
    const load = (callId: string, name: string, tools: McpTool[]) =>
      arm === 'reference' ? [call(callId, openName, { name }), result(callId, refs(tools))] : [call(callId, openName, { name }), result(callId, `Opened '${name}'.`), addition(tools)]
    const afterKv = [user1, ...load('call_1', 'kv-api', kv)]
    const afterD1 = [...afterKv, ...kvCall, ...load('call_3', 'd1-api', d1)]
    console.log(label('first turn') + (await ask(id, tools, [user1], beta)))
    console.log(label('the same request again') + (await ask(id, tools, [user1], beta)))
    console.log(label('after loading kv') + (await ask(id, tools, afterKv, beta)))
    console.log(label('the same request again') + (await ask(id, tools, afterKv, beta)))
    console.log(label('after loading d1') + (await ask(id, tools, afterD1, beta)))
  } else {
    const opened = (callId: string, name: string) => [call(callId, openName, { name }), result(callId, `Opened '${name}'.`)]
    const afterKv = [user1, ...opened('call_1', 'kv-api')]
    const afterD1 = [...afterKv, ...kvCall, ...opened('call_3', 'd1-api')]
    console.log(label('first turn') + (await ask(id, [openGroup(id)], [user1])))
    console.log(label('the same request again') + (await ask(id, [openGroup(id)], [user1])))
    console.log(label('kv appended to tools') + (await ask(id, [openGroup(id), ...kv.map(resident)], afterKv)))
    console.log(label('the same request again') + (await ask(id, [openGroup(id), ...kv.map(resident)], afterKv)))
    console.log(label('d1 appended to tools') + (await ask(id, [openGroup(id), ...kv.map(resident), ...d1.map(resident)], afterD1)))
  }
}
