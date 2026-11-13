// Asks where an endpoint puts tool definitions relative to the system prompt, from its cache counts. It warms a request,
// then changes one thing at a time: the start of the system prompt, the first tool, the last tool. If tools are rendered
// first, a new system prompt still reads the tool block from cache and a changed first tool reads nothing. If the system
// prompt is first, it is the other way round.
// Usage: tsx scripts/agent-probe-order.ts [--models a,b] [--groups a,b] [--no-affinity] [--wait ms] [--env <.env path>]
// --groups names the groups whose tools make up the tool block, kv-api by default (13 tools, about 4k tokens).
// Each run sends one x-session-affinity value, as agent-run.ts does per session. --no-affinity leaves the header out.
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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
const token = process.env.HF_TOKEN ?? (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : undefined)
const affinity = !args.includes('--no-affinity')
// The pause after each request, for an endpoint whose cache takes time to become readable.
const wait = Number(opt('wait', '3000'))
const models = opt('models', 'zai-org/GLM-5.3-Flash:baseten,deepseek-ai/DeepSeek-V4.1-Flash:baseten,Qwen/Qwen3.6-35B-A3B:deepinfra')!.split(',')

type McpTool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
const Loose = z.looseObject({})
const client = new Client({ name: 'groups-agent-probe', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/groups': {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL('https://pd-groups-opt2-rec.olahungerford.workers.dev/mcp')))
const kv: McpTool[] = []
for (const name of opt('groups', 'kv-api')!.split(',')) kv.push(...((await client.request({ method: 'groups/get', params: { name } }, Loose)) as { tools: McpTool[] }).tools)
const listing = ((await client.request({ method: 'groups/list', params: {} }, Loose)) as { groups: { name: string; description?: string }[] }).groups.map((g) => `- ${g.name}: ${g.description ?? ''}`).join('\n')
await client.close()

const asFn = (tool: McpTool, mark = '') => ({ type: 'function', function: { name: tool.name, description: `${tool.description ?? ''}${mark}`, parameters: tool.inputSchema } })
/** The tool block, with a marker on the tool at `at` when given. */
const tools = (at?: number, mark = '') => kv.map((tool, i) => asFn(tool, i === at ? ` [${mark}]` : ''))
const system = (id: string) => `Probe ${id}. You are connected to an MCP server. Its groups:\n${listing}`

async function ask(model: string, id: string, toolList: unknown[], run: string): Promise<{ prompt: number; cached: number }> {
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'mcp-progressive-disclosure-evals/0.1', ...(affinity ? { 'x-session-affinity': run } : {}) },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 8, chat_template_kwargs: { enable_thinking: false }, tools: toolList, messages: [{ role: 'system', content: system(id) }, { role: 'user', content: 'Reply with the word ok.' }] })
  })
  if (!response.ok) throw new Error(`${model}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)
  const usage = ((await response.json()) as { usage: { prompt_tokens: number; prompt_tokens_details?: { cached_tokens?: number } | null } }).usage
  await new Promise((resolve) => setTimeout(resolve, wait))
  return { prompt: usage.prompt_tokens, cached: usage.prompt_tokens_details?.cached_tokens ?? 0 }
}

console.log('| Model | Prompt tokens | Repeat of the warm request | New start of the system prompt, same tools | Same system prompt, first tool changed | Same system prompt, last tool changed |')
console.log('| :-- | --: | --: | --: | --: | --: |')
for (const model of models) {
  const run = randomUUID()
  // The run id sits on the first tool, so nothing an earlier run cached can match.
  const base = tools(0, run)
  const a = `${run}-a`
  const b = `${run}-b`
  await ask(model, a, base, run)
  const repeat = await ask(model, a, base, run)
  const newSystem = await ask(model, b, base, run)
  const firstTool = await ask(model, b, tools(0, `${run}-first`), run)
  // The base again, so the last comparison starts from a warm system prompt and tool block.
  await ask(model, b, base, run)
  const lastTool = await ask(model, b, kv.map((tool, i) => asFn(tool, i === 0 ? ` [${run}]` : i === kv.length - 1 ? ` [${run}-last]` : '')), run)
  console.log(`| ${model} | ${repeat.prompt} | ${repeat.cached} | ${newSystem.cached} | ${firstTool.cached} | ${lastTool.cached} |`)
}
