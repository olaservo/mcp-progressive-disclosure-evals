// Asks whether the two Baseten models take deferred tools in the shape Baseten documents
// (docs.baseten.co/inference/model-apis/deferred-tool-loading): `defer_loading` beside `function` on the tool object, and a
// tool message whose content is `tool_reference` blocks keyed by `tool_name`. agent-probe.ts sent the shape the public chat
// templates read: `defer_loading` inside `function` and references keyed by `name`.
// Each line prints the provider's prompt and cached token counts and the model's tool calls. The deferred run opens two
// groups in one conversation, and the control appends the same tools to `tools` as arm B does.
// With --base-url the request goes to that endpoint with the key in --key-env, and the :provider suffix is dropped from the
// default model ids. Baseten's own endpoint is https://inference.baseten.co/v1.
// For OpenRouter (openrouter.ai/docs/guides/features/server-tools/tool-search, Client-Side Tool Search): --provider pins the
// request to one provider, --open-name renames open_group, since OpenRouter wants a loaded tool named like a search tool, and
// --resend adds a run in OpenRouter's Chat Completions shape, with the flag inside `function` and a group revealed by sending
// its tools again without the flag.
// Usage: tsx scripts/agent-probe-deferred.ts [--models a,b] [--wait ms] [--env <.env path>] [--base-url <url> --key-env <NAME>] [--provider slug] [--open-name name] [--resend] [--keep-reasoning] [--cache-control]
import { existsSync, readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
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
const tokenFile = join(homedir(), '.cache', 'huggingface', 'token')
const baseUrl = opt('base-url')?.replace(/\/$/, '')
const keyEnv = opt('key-env', 'BASETEN_API_KEY')!
const token = baseUrl ? process.env[keyEnv] : (process.env.HF_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : undefined))
if (!token) throw new Error(baseUrl ? `${keyEnv} is not set` : 'no Hugging Face token')
const endpoint = `${baseUrl ?? 'https://router.huggingface.co/v1'}/chat/completions`
const wait = Number(opt('wait', '3000'))
const provider = opt('provider')
const openName = opt('open-name', 'open_group')!
const resend = args.includes('--resend')
const keepReasoning = args.includes('--keep-reasoning')
// Top-level automatic caching, for Anthropic models, which cache only where the request asks.
const cacheControl = args.includes('--cache-control')
const defaults = ['zai-org/GLM-5.3-Flash:baseten', 'deepseek-ai/DeepSeek-V4.1-Flash:baseten'].map((id) => (baseUrl ? id.replace(/:.*$/, '') : id))
const models = opt('models', defaults.join(','))!.split(',')

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const group = async (name: string) => ((await client.request({ method: 'groups/get', params: { name } }, z.looseObject({}))) as { tools: McpTool[] }).tools
const kv = await group('kv-api')
const d1 = await group('d1-api')
await client.close()

const fnOf = (tool: McpTool) => ({ name: tool.name, description: tool.description ?? '', parameters: tool.inputSchema })
const resident = (tool: McpTool) => ({ type: 'function', function: fnOf(tool) })
const deferred = (tool: McpTool) => ({ type: 'function', function: fnOf(tool), defer_loading: true })
const nested = (tool: McpTool) => ({ type: 'function', function: { ...fnOf(tool), defer_loading: true } })
const openGroup = (id: string) => ({ type: 'function', function: { name: openName, description: `Open a capability group by name. Makes its tools callable. [probe ${id}]`, parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } })

// About 3k tokens of filler, so a cached prefix is large enough to show in the counts.
const filler = Array.from({ length: 1500 }, (_, i) => createHash('sha256').update(`pad-${i}`).digest('hex').slice(0, 6)).join(' ')
const system = (id: string) => ({ role: 'system', content: `Probe ${id}. You are connected to an MCP server whose tools are dry runs. The account id is demo. Use the tools and do not ask questions. Open a group before using its tools. Groups: kv-api (key-value store), d1-api (SQL databases).\n\nNotes with no information in them: ${filler}` })
const user1 = { role: 'user', content: 'In the key-value namespace with id demo-kv, list the keys that begin with session:.' }
const user2 = { role: 'user', content: 'Now list the D1 databases in the account.' }
const call = (id: string, name: string, input: Record<string, unknown>) => ({ role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(input) } }] })
const result = (id: string, content: unknown) => ({ role: 'tool', tool_call_id: id, content })
const refs = (tools: McpTool[], key: 'tool_name' | 'name' = 'tool_name') => tools.map((tool) => ({ type: 'tool_reference', [key]: tool.name }))

async function ask(model: string, session: string, tools: unknown[], messages: unknown[]): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1', 'x-session-affinity': session },
    body: JSON.stringify({ model, temperature: 0.2, max_tokens: 600, chat_template_kwargs: { enable_thinking: false }, ...(cacheControl ? { cache_control: { type: 'ephemeral' } } : {}), ...(provider ? { provider: { only: [provider], allow_fallbacks: false }, ...(keepReasoning ? {} : { reasoning: { enabled: false } }) } : {}), tools, messages })
  })
  const text = await response.text()
  await new Promise((resolve) => setTimeout(resolve, wait))
  if (!response.ok) return `HTTP ${response.status} ${text.replace(/\s+/g, ' ').slice(0, 300)}`
  const parsed = JSON.parse(text) as { provider?: string; choices: { finish_reason?: string; message: { content?: string | null; tool_calls?: { function: { name: string } }[] } }[]; usage: { prompt_tokens: number; prompt_tokens_details?: { cached_tokens?: number } | null } }
  const debug = process.env.PROBE_DEBUG ? `, finish ${parsed.choices[0]!.finish_reason}, provider ${parsed.provider ?? '-'}, text ${JSON.stringify((parsed.choices[0]!.message.content ?? '').slice(0, 160))}` : ''
  return `prompt ${parsed.usage.prompt_tokens}, cached ${parsed.usage.prompt_tokens_details?.cached_tokens ?? 0}, calls ${parsed.choices[0]!.message.tool_calls?.map((c) => c.function.name).join(',') ?? 'none'}${debug}`
}

for (const model of models) {
  console.log(model)
  {
    const id = randomUUID()
    const tools = [openGroup(id), ...kv.map(deferred), ...d1.map(deferred)]
    const first = [system(id), user1]
    const afterKv = [...first, call('call_1', openName, { name: 'kv-api' }), result('call_1', refs(kv))]
    const afterD1 = [...afterKv, call('call_2', 'kv_keys_list', { account_id: 'demo', namespace_id: 'demo-kv', prefix: 'session:' }), result('call_2', '{"dryRun":true}'), { role: 'assistant', content: 'Listed.' }, user2, call('call_3', openName, { name: 'd1-api' }), result('call_3', refs(d1))]
    console.log(`  deferred beside function, ${kv.length + d1.length} tools, first turn:  ${await ask(model, id, tools, first)}`)
    console.log(`  the same request again:                        ${await ask(model, id, tools, first)}`)
    console.log(`  after open, tool_reference by tool_name (kv):  ${await ask(model, id, tools, afterKv)}`)
    console.log(`  the same request again:                        ${await ask(model, id, tools, afterKv)}`)
    console.log(`  second open, tool_reference by tool_name (d1): ${await ask(model, id, tools, afterD1)}`)
    console.log(`  tool_reference by name, as agent-probe.ts:     ${await ask(model, id, tools, [...first, call('call_1', openName, { name: 'kv-api' }), result('call_1', refs(kv, 'name'))])}`)
  }
  {
    const id = randomUUID()
    console.log(`  defer_loading inside function, first turn:     ${await ask(model, id, [openGroup(id), ...kv.map(nested), ...d1.map(nested)], [system(id), user1])}`)
  }
  if (resend) {
    const id = randomUUID()
    const first = [system(id), user1]
    const afterKv = [...first, call('call_1', openName, { name: 'kv-api' }), result('call_1', "Opened 'kv-api'.")]
    const afterD1 = [...afterKv, call('call_2', 'kv_keys_list', { account_id: 'demo', namespace_id: 'demo-kv', prefix: 'session:' }), result('call_2', '{"dryRun":true}'), { role: 'assistant', content: 'Listed.' }, user2, call('call_3', openName, { name: 'd1-api' }), result('call_3', "Opened 'd1-api'.")]
    const none = [openGroup(id), ...kv.map(nested), ...d1.map(nested)]
    const kvShown = [openGroup(id), ...kv.map(resident), ...d1.map(nested)]
    const allShown = [openGroup(id), ...kv.map(resident), ...d1.map(resident)]
    console.log(`  resend: flag inside function, first turn:      ${await ask(model, id, none, first)}`)
    console.log(`  the same request again:                        ${await ask(model, id, none, first)}`)
    console.log(`  resend: kv tools sent without the flag:        ${await ask(model, id, kvShown, afterKv)}`)
    console.log(`  the same request again:                        ${await ask(model, id, kvShown, afterKv)}`)
    console.log(`  resend: d1 tools sent without the flag:        ${await ask(model, id, allShown, afterD1)}`)
  }
  {
    const id = randomUUID()
    const first = [system(id), user1]
    const afterKv = [...first, call('call_1', openName, { name: 'kv-api' }), result('call_1', "Opened 'kv-api'.")]
    const afterD1 = [...afterKv, call('call_2', 'kv_keys_list', { account_id: 'demo', namespace_id: 'demo-kv', prefix: 'session:' }), result('call_2', '{"dryRun":true}'), { role: 'assistant', content: 'Listed.' }, user2, call('call_3', openName, { name: 'd1-api' }), result('call_3', "Opened 'd1-api'.")]
    console.log(`  control, open_group only, first turn:          ${await ask(model, id, [openGroup(id)], first)}`)
    console.log(`  the same request again:                        ${await ask(model, id, [openGroup(id)], first)}`)
    console.log(`  control, kv tools appended to tools:           ${await ask(model, id, [openGroup(id), ...kv.map(resident)], afterKv)}`)
    console.log(`  the same request again:                        ${await ask(model, id, [openGroup(id), ...kv.map(resident)], afterKv)}`)
    console.log(`  control, d1 tools appended to tools:           ${await ask(model, id, [openGroup(id), ...kv.map(resident), ...d1.map(resident)], afterD1)}`)
  }
}
