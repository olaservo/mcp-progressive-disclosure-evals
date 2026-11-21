// Asks whether OpenRouter's `deferred_tools` protocol (openrouter.ai/docs/guides/features/server-tools/tool-search) keeps the
// prompt cache when a client-executed (`custom`) search loads tools on Chat Completions. The kv and d1 tools are sent with
// `function.defer_loading`, and `group_search` is the custom search: the client returns the group's tool names under the
// result key. The loop is model-driven and echoes each assistant message as returned, since OpenRouter keeps the protocol
// state in `reasoning_details`. After each load the same request is sent again.
// Each line prints prompt and cached tokens and the tools called.
// Usage: tsx scripts/agent-probe-openrouter-deferred.ts --models a@provider,b@provider [--cache-control] [--wait ms] [--env <.env path>]
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
const token = process.env.OPENROUTER_API_KEY
if (!token) throw new Error('OPENROUTER_API_KEY is not set')
const models = opt('models', 'deepseek/deepseek-v4.1-flash@baseten,anthropic/claude-haiku-5.5@anthropic')!.split(',')
const cacheControl = args.includes('--cache-control')
const wait = Number(opt('wait', '3000'))

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const group = async (name: string) => ((await client.request({ method: 'groups/get', params: { name } }, z.looseObject({}))) as { tools: McpTool[] }).tools
const groups: Record<string, McpTool[]> = { 'kv-api': await group('kv-api'), 'd1-api': await group('d1-api') }
await client.close()

const deferred = (tool: McpTool) => ({ type: 'function', function: { name: tool.name, description: tool.description ?? '', parameters: tool.inputSchema, defer_loading: true } })
const search = (id: string) => ({ type: 'function', function: { name: 'group_search', description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, parameters: { type: 'object', properties: { name: { type: 'string', description: 'kv-api or d1-api' } }, required: ['name'] } } })
const filler = Array.from({ length: 1500 }, (_, i) => createHash('sha256').update(`pad-${i}`).digest('hex').slice(0, 6)).join(' ')
const system = (id: string) => ({ role: 'system', content: `Probe ${id}. You are connected to an MCP server whose tools are dry runs. The account id is demo. Use the tools and do not ask questions. Open a group with group_search before using its tools. Groups: kv-api (key-value store), d1-api (SQL databases).\n\nNotes with no information in them: ${filler}` })
const userTurns = ['In the key-value namespace with id demo-kv, list the keys that begin with session:.', 'Now list the D1 databases in the account.']

type Message = { role: string; content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; [key: string]: unknown }
type Reply = { message: Message; line: string } | { error: string }

async function ask(spec: string, session: string, tools: unknown[], messages: unknown[]): Promise<Reply> {
  const [model, provider] = spec.split('@')
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1', 'x-session-affinity': session },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      ...(provider ? { provider: { only: [provider], allow_fallbacks: false } } : {}),
      ...(cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
      tools,
      deferred_tools: { protocol: 'v1', profile: 'portable', validation: 'runtime', search: { type: 'custom', tool_id: 'group_search', result_key: 'tools' }, max_results: 20 },
      messages
    })
  })
  const text = await response.text()
  await new Promise((resolve) => setTimeout(resolve, wait))
  if (!response.ok) return { error: `HTTP ${response.status} ${text.replace(/\s+/g, ' ').slice(0, 600)}` }
  const parsed = JSON.parse(text) as { provider?: string; choices: { message: Message }[]; usage: { prompt_tokens: number; prompt_tokens_details?: { cached_tokens?: number } | null } }
  const message = parsed.choices[0]!.message
  const calls = message.tool_calls?.map((c) => `${c.function.name}${c.function.name === 'group_search' ? c.function.arguments : ''}`).join(',') || 'none'
  return { message, line: `prompt ${parsed.usage.prompt_tokens}, cached ${parsed.usage.prompt_tokens_details?.cached_tokens ?? 0}, calls ${calls}, provider ${parsed.provider ?? '-'}` }
}

for (const spec of models) {
  console.log(`${spec}${cacheControl ? ' (top-level cache_control)' : ''}`)
  const id = randomUUID()
  const tools = [search(id), ...groups['kv-api']!.map(deferred), ...groups['d1-api']!.map(deferred)]
  const messages: unknown[] = [system(id)]
  const label = (text: string) => `  ${text.padEnd(32)}`
  run: for (const [turn, text] of userTurns.entries()) {
    messages.push({ role: 'user', content: text })
    let loaded = false
    for (let request = 0; request < 6; request++) {
      const reply = await ask(spec, id, tools, messages)
      if ('error' in reply) {
        console.log(label(`turn ${turn + 1} request ${request + 1}`) + reply.error)
        break run
      }
      console.log(label(loaded ? '  after the load' : `turn ${turn + 1} request ${request + 1}`) + reply.line)
      if (loaded) {
        const again = await ask(spec, id, tools, messages)
        console.log(label('  the same request again') + ('error' in again ? again.error : again.line))
        loaded = false
      } else if (turn === 0 && request === 0) {
        const again = await ask(spec, id, tools, messages)
        console.log(label('  the same request again') + ('error' in again ? again.error : again.line))
      }
      messages.push(reply.message)
      const calls = reply.message.tool_calls ?? []
      if (calls.length === 0) break
      for (const call of calls) {
        if (call.function.name === 'group_search') {
          const name = String((JSON.parse(call.function.arguments || '{}') as { name?: string }).name ?? '')
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ tools: (groups[name] ?? []).map((tool) => tool.name) }) })
          loaded = true
        } else messages.push({ role: 'tool', tool_call_id: call.id, content: '{"dryRun":true}' })
      }
    }
  }
}
