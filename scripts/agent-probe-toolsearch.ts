// Asks whether the Messages API accepts a whole MCP catalog as deferred tools behind its own tool search, and what a request costs.
// Lists every tool on a flat server, sends them all with `defer_loading` beside the BM25 tool search tool, and sends the same
// request twice to read the cache fields. Prints usage, the search queries the model wrote and the tools the search returned.
// Usage: tsx scripts/agent-probe-toolsearch.ts [--url <flat mcp url>] [--model id] [--task text] [--limit N] [--env <.env path>]
import { readFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 ? args[at + 1] : fallback
}
const envFile = opt('env')
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}
const url = opt('url', 'http://localhost:8787/flat/mcp')!
const model = opt('model', 'claude-haiku-5-5')!
const task = opt('task', 'Remove every entry whose key begins with "session:" from the edge key-value store.')!
const limit = Number(opt('limit', '0'))

const mcp = new Client({ name: 'groups-probe-toolsearch', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await mcp.connect(new StreamableHTTPClientTransport(new URL(url)))
const listed = []
let cursor: string | undefined
do {
  const page = await mcp.listTools(cursor ? { cursor } : undefined)
  listed.push(...page.tools)
  cursor = page.nextCursor
} while (cursor)
await mcp.close()
const catalog = limit ? listed.slice(0, limit) : listed

const tools: Anthropic.ToolUnion[] = [
  { type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' },
  ...catalog.map((tool) => ({ name: tool.name, description: tool.description ?? '', input_schema: tool.inputSchema as Anthropic.Tool.InputSchema, defer_loading: true }))
]
console.log(`${catalog.length} tools deferred, ${Math.round(JSON.stringify(tools).length / 1024)} KiB of tool definitions, model ${model}`)

const anthropic = new Anthropic()
for (const label of ['first request', 'the same request again']) {
  const started = Date.now()
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: 'You operate a Cloudflare account through tools. Find the tool for the task and call it.',
      tools,
      messages: [{ role: 'user', content: task }]
    })
    const blocks = response.content as Array<Record<string, any>>
    const queries = blocks.filter((block) => block.type === 'server_tool_use').map((block) => JSON.stringify(block.input))
    const found = blocks.filter((block) => block.type === 'tool_search_tool_result').flatMap((block) => (block.content?.tool_references ?? []).map((ref: { tool_name: string }) => ref.tool_name))
    const called = blocks.filter((block) => block.type === 'tool_use').map((block) => block.name)
    console.log(`${label}: ${Date.now() - started} ms, stop ${response.stop_reason}`)
    console.log(`  usage ${JSON.stringify(response.usage)}`)
    console.log(`  searched ${queries.join(' ; ') || '(nothing)'}`)
    console.log(`  search returned ${found.join(', ') || '(nothing)'}`)
    console.log(`  called ${called.join(', ') || '(nothing)'}`)
    const said = blocks.filter((block) => block.type === 'text').map((block) => block.text).join(' ').replace(/\s+/g, ' ')
    if (said) console.log(`  said ${said.slice(0, 300)}`)
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.log(`${label}: 429 ${error.message}`)
    else if (error instanceof Anthropic.BadRequestError) console.log(`${label}: 400 ${error.message}`)
    else if (error instanceof Anthropic.APIError) console.log(`${label}: ${error.status} ${error.message}`)
    else throw error
  }
}
