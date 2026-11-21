// Asks whether a Responses API endpoint keeps its prompt cache when tools are loaded mid-conversation in the shapes OpenAI
// documents (developers.openai.com/api/docs/guides/tools-tool-search): a client-executed `tool_search` answered by a
// `tool_search_output` item, and an `additional_tools` input item. The control appends the same tools to `tools`.
// Each line prints the input and cached token counts and the output items. The conversation is the one agent-probe-deferred.ts
// uses, written as input items, and every request carries the whole input.
// A model given as id@provider is pinned to that provider, which is OpenRouter's `provider` field.
// Usage: tsx scripts/agent-probe-responses.ts --models a,b@provider [--base-url <url> --key-env <NAME>] [--wait ms] [--env <.env path>] [--orphan]
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
const baseUrl = opt('base-url', 'https://openrouter.ai/api/v1')!.replace(/\/$/, '')
const keyEnv = opt('key-env', 'OPENROUTER_API_KEY')!
const token = process.env[keyEnv]
if (!token) throw new Error(`${keyEnv} is not set`)
const wait = Number(opt('wait', '3000'))
const models = opt('models', 'openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash@baseten')!.split(',')

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const group = async (name: string) => ((await client.request({ method: 'groups/get', params: { name } }, z.looseObject({}))) as { tools: McpTool[] }).tools
const kv = await group('kv-api')
const d1 = await group('d1-api')
await client.close()

const resident = (tool: McpTool) => ({ type: 'function', name: tool.name, description: tool.description ?? '', parameters: tool.inputSchema, strict: false })
const deferred = (tool: McpTool) => ({ ...resident(tool), defer_loading: true })
const openGroup = (id: string) => ({ type: 'function', name: 'open_group', description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }, strict: false })
const toolSearch = (id: string) => ({ type: 'tool_search', execution: 'client', description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false } })

const filler = Array.from({ length: 1500 }, (_, i) => createHash('sha256').update(`pad-${i}`).digest('hex').slice(0, 6)).join(' ')
const system = (id: string, how: string) => ({ role: 'developer', content: `Probe ${id}. You are connected to an MCP server whose tools are dry runs. The account id is demo. Use the tools and do not ask questions. ${how} Groups: kv-api (key-value store), d1-api (SQL databases).\n\nNotes with no information in them: ${filler}` })
const user1 = { role: 'user', content: 'In the key-value namespace with id demo-kv, list the keys that begin with session:.' }
const user2 = { role: 'user', content: 'Now list the D1 databases in the account.' }
const said = { role: 'assistant', content: 'Listed.' }
const fnCall = (id: string, name: string, input: Record<string, unknown>) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(input) })
const fnOut = (id: string, output: string) => ({ type: 'function_call_output', call_id: id, output })
const searchCall = (id: string, name: string) => ({ type: 'tool_search_call', execution: 'client', call_id: id, status: 'completed', arguments: { name } })
const searchOut = (id: string, tools: McpTool[]) => ({ type: 'tool_search_output', execution: 'client', call_id: id, status: 'completed', tools: tools.map(deferred) })
const additional = (tools: McpTool[]) => ({ type: 'additional_tools', role: 'developer', tools: tools.map(resident) })
const kvCall = [fnCall('call_2', 'kv_keys_list', { account_id: 'demo', namespace_id: 'demo-kv', prefix: 'session:' }), fnOut('call_2', '{"dryRun":true}'), said, user2]

async function ask(spec: string, session: string, tools: unknown[], input: unknown[]): Promise<string> {
  const [model, provider] = spec.split('@')
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1' },
    body: JSON.stringify({ model, max_output_tokens: 800, parallel_tool_calls: false, prompt_cache_key: session, ...(provider ? { provider: { only: [provider], allow_fallbacks: false } } : {}), tools, input })
  })
  const text = await response.text()
  await new Promise((resolve) => setTimeout(resolve, wait))
  if (!response.ok) return `HTTP ${response.status} ${text.replace(/\s+/g, ' ').slice(0, 400)}`
  const parsed = JSON.parse(text) as { output?: { type: string; name?: string; content?: { text?: string }[] }[]; usage?: { input_tokens: number; input_tokens_details?: { cached_tokens?: number } | null } }
  const items = (parsed.output ?? []).filter((item) => item.type !== 'reasoning').map((item) => (item.type === 'function_call' ? `function_call ${item.name}` : item.type === 'message' ? `message ${JSON.stringify((item.content?.[0]?.text ?? '').slice(0, 100))}` : item.type))
  return `input ${parsed.usage?.input_tokens}, cached ${parsed.usage?.input_tokens_details?.cached_tokens ?? 0}, output ${items.join('; ') || 'none'}`
}

for (const spec of models) {
  console.log(spec)
  {
    const id = randomUUID()
    const tools = [toolSearch(id)]
    const first = [system(id, 'Open a group with the tool search before using its tools.'), user1]
    const afterKv = [...first, searchCall('call_1', 'kv-api'), searchOut('call_1', kv)]
    const afterD1 = [...afterKv, ...kvCall, searchCall('call_3', 'd1-api'), searchOut('call_3', d1)]
    console.log(`  client tool_search only, first turn:           ${await ask(spec, id, tools, first)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, tools, first)}`)
    console.log(`  after tool_search_output with kv tools:        ${await ask(spec, id, tools, afterKv)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, tools, afterKv)}`)
    console.log(`  after a second tool_search_output, d1 tools:   ${await ask(spec, id, tools, afterD1)}`)
  }
  {
    const id = randomUUID()
    const tools = [openGroup(id)]
    const first = [system(id, 'Open a group before using its tools.'), user1]
    const afterKv = [...first, fnCall('call_1', 'open_group', { name: 'kv-api' }), fnOut('call_1', "Opened 'kv-api'."), additional(kv)]
    const afterD1 = [...afterKv, ...kvCall, fnCall('call_3', 'open_group', { name: 'd1-api' }), fnOut('call_3', "Opened 'd1-api'."), additional(d1)]
    console.log(`  open_group only, first turn:                   ${await ask(spec, id, tools, first)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, tools, first)}`)
    console.log(`  after additional_tools with kv tools:          ${await ask(spec, id, tools, afterKv)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, tools, afterKv)}`)
    console.log(`  after a second additional_tools, d1 tools:     ${await ask(spec, id, tools, afterD1)}`)
  }
  if (args.includes('--orphan')) {
    // A tool_search_output with no tool_search_call before it, after an ordinary function call.
    const id = randomUUID()
    const first = [system(id, 'Open a group before using its tools.'), user1]
    const opened = [...first, fnCall('call_1', 'open_group', { name: 'kv-api' }), fnOut('call_1', "Opened 'kv-api'.")]
    console.log(`  open_group only, first turn:                   ${await ask(spec, id, [openGroup(id)], first)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, [openGroup(id)], first)}`)
    console.log(`  tool_search_output with no call, no search tool: ${await ask(spec, id, [openGroup(id)], [...opened, searchOut('call_9', kv)])}`)
    console.log(`  the same, tool_search also in tools:           ${await ask(spec, id, [openGroup(id), toolSearch(id)], [...opened, searchOut('call_9', kv)])}`)
    console.log(`  the same, without a call_id:                   ${await ask(spec, id, [openGroup(id), toolSearch(id)], [...opened, { ...searchOut('call_9', kv), call_id: undefined }])}`)
  }
  {
    const id = randomUUID()
    const first = [system(id, 'Open a group before using its tools.'), user1]
    const afterKv = [...first, fnCall('call_1', 'open_group', { name: 'kv-api' }), fnOut('call_1', "Opened 'kv-api'.")]
    const afterD1 = [...afterKv, ...kvCall, fnCall('call_3', 'open_group', { name: 'd1-api' }), fnOut('call_3', "Opened 'd1-api'.")]
    console.log(`  control, open_group only, first turn:          ${await ask(spec, id, [openGroup(id)], first)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, [openGroup(id)], first)}`)
    console.log(`  control, kv tools appended to tools:           ${await ask(spec, id, [openGroup(id), ...kv.map(resident)], afterKv)}`)
    console.log(`  the same request again:                        ${await ask(spec, id, [openGroup(id), ...kv.map(resident)], afterKv)}`)
    console.log(`  control, d1 tools appended to tools:           ${await ask(spec, id, [openGroup(id), ...kv.map(resident), ...d1.map(resident)], afterD1)}`)
  }
}
