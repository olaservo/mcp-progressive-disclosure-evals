// Connects to a local MCP Toolbox for Databases server and prints what it serves: the negotiated version, its
// capabilities, its tools, and its groups through the server's own groups extension (`groups/list`, `groups/get`).
// Usage: tsx scripts/toolbox-probe.ts [--url http://127.0.0.1:5055/mcp]
import * as z from 'zod/v4'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const url = args.includes('--url') ? args[args.indexOf('--url') + 1]! : 'http://127.0.0.1:5055/mcp'
const TOOLBOX = 'com.google.cloud/toolbox.v1'
const Loose = z.looseObject({})

// The server checks an `Mcp-Name` header against `params.name`, and the client library sets none for a method it
// does not know, so `groups/get` is posted directly.
async function groupsGet(name: string): Promise<{ tools?: { name: string }[]; prompts?: unknown[]; resources?: unknown[] }> {
  const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'groups-toolbox-probe', version: '0.1.0' }, 'io.modelcontextprotocol/clientCapabilities': { extensions: { [TOOLBOX]: {} } } }
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2026-07-28', 'mcp-method': 'groups/get', 'mcp-name': name },
    body: JSON.stringify({ jsonrpc: '2.0', id: `get-${name}`, method: 'groups/get', params: { name, _meta: meta } })
  })
  const text = await response.text()
  const json = JSON.parse(text.startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data:'))!.slice(5)) as { result?: object; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result as { tools?: { name: string }[] }
}

const client = new Client({ name: 'groups-toolbox-probe', version: '0.1.0' }, { capabilities: { extensions: { [TOOLBOX]: {} } }, versionNegotiation: { mode: 'auto' } })
await client.connect(new StreamableHTTPClientTransport(new URL(url)))
console.log(`server ${JSON.stringify(client.getServerVersion())}`)
console.log(`capabilities ${JSON.stringify(client.getServerCapabilities())}`)
const { tools } = await client.listTools()
console.log(`\n${tools.length} tools, ${JSON.stringify(tools).length} characters`)
for (const tool of tools) console.log(`  ${tool.name} (${Object.keys((tool.inputSchema as { properties?: object }).properties ?? {}).join(', ')}): ${(tool.description ?? '').slice(0, 90)}`)
try {
  const listed = (await client.request({ method: 'groups/list', params: {} }, Loose)) as { groups?: { name: string; description?: string }[] }
  console.log(`\n${listed.groups?.length ?? 0} groups`)
  for (const group of listed.groups ?? []) {
    const body = await groupsGet(group.name)
    console.log(`  ${group.name}: ${group.description ?? '(no description)'} | ${(body.tools ?? []).map((tool) => tool.name).join(', ')} | prompts ${body.prompts?.length ?? 0}, resources ${body.resources?.length ?? 0}`)
  }
} catch (error) {
  console.log(`\ngroups: ${String(error)}`)
}
await client.close()
