// Minimal reproduction: Baseten's deferred tool loading called directly and through OpenRouter pinned to Baseten.
// No dependencies. Node 22 or later.
//   BASETEN_API_KEY=... OPENROUTER_API_KEY=... node repro-deferred-loading.mjs
// One loaded tool (group_search) and one deferred tool (kv_keys_list) whose description is about 3k tokens.
// Each line prints the provider's prompt and cached token counts and the tool the model called.
// Request 0 sends the tool undeferred, to show the prompt size deferral saves. Request 4 is a plain append on Baseten direct
// and is OpenRouter's documented reveal through OpenRouter.
// The tool block renders ahead of the system prompt on this model, so the run id goes in the first tool. Each endpoint has its
// own id, and request 0 has another, so no request reads a cache that a different request wrote.
const pad = (label, words) => Array.from({ length: words }, (_, i) => `${label}${i}`).join(' ')
const kv = { name: 'kv_keys_list', description: `List the keys in a key-value namespace. Filler: ${pad('d', 1500)}`, parameters: { type: 'object', properties: { namespace_id: { type: 'string' }, prefix: { type: 'string' } }, required: ['namespace_id'] } }
const deferred = { type: 'function', function: kv, defer_loading: true }
const resident = { type: 'function', function: kv }

const user = { role: 'user', content: 'In the key-value namespace demo-kv, list the keys that begin with session:.' }
const opened = { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'group_search', arguments: '{"name":"kv-api"}' } }] }
const byReference = { role: 'tool', tool_call_id: 'call_1', content: [{ type: 'tool_reference', tool_name: 'kv_keys_list' }] }
const byText = { role: 'tool', tool_call_id: 'call_1', content: "Opened 'kv-api'." }

async function ask(endpoint, label, tools, messages) {
  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${endpoint.key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: endpoint.model, max_tokens: 300, temperature: 0, ...endpoint.extra, tools, messages })
  })
  const body = await response.json()
  const line = response.ok ? `prompt ${body.usage.prompt_tokens}, cached ${body.usage.prompt_tokens_details?.cached_tokens ?? 0}, called ${body.choices[0].message.tool_calls?.map((c) => c.function.name).join(',') ?? 'nothing'}` : `HTTP ${response.status} ${JSON.stringify(body).slice(0, 200)}`
  console.log(`  ${label.padEnd(52)} ${line}`)
  await new Promise((resolve) => setTimeout(resolve, 3000))
}

const endpoints = [
  { name: 'Baseten direct', url: 'https://inference.baseten.co/v1/chat/completions', key: process.env.BASETEN_API_KEY, model: 'deepseek-ai/DeepSeek-V4.1-Flash', extra: {} },
  { name: 'OpenRouter, pinned to Baseten', url: 'https://openrouter.ai/api/v1/chat/completions', key: process.env.OPENROUTER_API_KEY, model: 'deepseek/deepseek-v4.1-flash', extra: { provider: { only: ['baseten'], allow_fallbacks: false } } }
]
for (const endpoint of endpoints) {
  if (!endpoint.key) continue
  const newId = () => Math.random().toString(36).slice(2)
  const searchTool = (id) => ({ type: 'function', function: { name: 'group_search', description: `Open a tool group by name. [run ${id}]`, parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } })
  const id = newId()
  const search = searchTool(id)
  const system = { role: 'system', content: `Run ${id}. Tools are dry runs. Call group_search with the group name before using a group's tools. Groups: kv-api (key-value store).\n\nFiller: ${pad('s', 1500)}` }
  console.log(endpoint.name)
  await ask(endpoint, '0. first turn, kv_keys_list not deferred', [searchTool(newId()), resident], [system, user])
  await ask(endpoint, '1. first turn, kv_keys_list deferred', [search, deferred], [system, user])
  await ask(endpoint, '2. the same request again', [search, deferred], [system, user])
  await ask(endpoint, '3. after a tool result of tool_reference', [search, deferred], [system, user, opened, byReference])
  await ask(endpoint, '4. after re-sending the tool without the flag', [search, resident], [system, user, opened, byText])
}
