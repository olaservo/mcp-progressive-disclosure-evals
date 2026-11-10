// Derives the v3 tasks' accepted groups from the servers as served. Each task names the tools that do any step it asks
// for (by name prefix, read from the catalog); a top-level group is accepted when it, or a group nested under it, returns
// one of those tools from groups/get. Prints scripts/select-v3.json, which select.ts reads for --tasks v3.
// Usage: tsx scripts/v3-answers.ts [--base http://localhost:8787]   (after npm run vendor:full and npm run dev)
import { readFileSync, writeFileSync } from 'node:fs'
import * as z from 'zod/v4'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const base = args.includes('--base') ? args[args.indexOf('--base') + 1]! : 'http://localhost:8787'
const Loose = z.looseObject({})
const GROUPS = 'io.modelcontextprotocol/groups'
const SKILLS = 'io.modelcontextprotocol/skills'

/** The tools that do a step of each task, in results/tasks-v3/tasks.json order. Chosen from the catalog's tool names. */
const NEEDS: { id: string; tools: string[] }[] = [
  { id: 'sending-subdomain', tools: ['emailSending_subdomains_create', 'emailSending_subdomains_dns'] },
  { id: 'count-failed', tools: ['d1_query', 'd1_raw'] },
  { id: 'eu-bucket', tools: ['r2_buckets_create', 'r2_buckets_lifecycle'] },
  { id: 'deploy-container', tools: ['containers_applications_create'] },
  { id: 'forward-support', tools: ['emailRouting_rules_create', 'emailRouting_rules_catchAll'] },
  { id: 'delayed-queue', tools: ['queues_create'] },
  { id: 'ipfs-gateway', tools: ['web3_hostnames_create'] },
  { id: 'first-party-tags', tools: ['googleTagGateway_config'] },
  { id: 'rate-limit-page', tools: ['customPages_'] },
  { id: 'endpoint-inventory', tools: ['webAssets_discovery', 'webAssets_operations', 'apiSecurity_schemaValidation'] },
  { id: 'rename-account', tools: ['accounts_update', 'accounts_get'] },
  { id: 'site-rollback', tools: ['pages_deployments_list', 'pages_deployments_rollback'] },
  { id: 'llm-proxy', tools: ['aiGateway_gateways_create'] },
  { id: 'private-connection', tools: ['tunnels_create', 'tunnels_config_update'] },
  { id: 'url-overrides', tools: ['pageRules_'] },
  { id: 'origin-protocols', tools: ['zones_settings'] },
  { id: 'edge-ranges', tools: ['ips_list'] },
  { id: 'eu-processing', tools: ['addressing_regionalHostnames'] },
  { id: 'appliance-events', tools: ['connectorTelemetryEvents_'] },
  { id: 'game-server', tools: ['spectrum_apps_create'] }
]

type Body = { tools?: { name: string }[]; groups?: { name: string }[] }
// The Worker allows 120 requests a minute per client.
const pace = () => new Promise((resolve) => setTimeout(resolve, 550))
async function subtreeTools(variant: string): Promise<Map<string, Set<string>>> {
  const client = new Client({ name: 'v3-answers', version: '0.1.0' }, { capabilities: { extensions: { [GROUPS]: {}, [SKILLS]: {} } }, versionNegotiation: { mode: 'auto' } })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/${variant}/mcp`)))
  const top = ((await client.request({ method: 'groups/list', params: {} }, Loose)) as { groups: { name: string }[] }).groups.map((g) => g.name)
  const out = new Map<string, Set<string>>()
  for (const name of top) {
    const tools = new Set<string>()
    const seen = new Set<string>()
    const queue = [name]
    while (queue.length > 0) {
      const next = queue.shift()!
      if (seen.has(next)) continue
      seen.add(next)
      await pace()
      const body = (await client.request({ method: 'groups/get', params: { name: next } }, Loose)) as Body
      for (const tool of body.tools ?? []) tools.add(tool.name)
      for (const child of body.groups ?? []) queue.push(child.name)
    }
    out.set(name, tools)
  }
  await client.close()
  return out
}

const tasks = JSON.parse(readFileSync('results/tasks-v3/tasks.json', 'utf8')) as { writer: string; product: string; task: string }[]
if (tasks.length !== NEEDS.length) throw new Error('NEEDS and tasks.json differ in length')
const listings = { 'opt2': await subtreeTools('opt2'), 'opt2-rec': await subtreeTools('opt2-rec') }
const result = tasks.map((task, i) => {
  const need = NEEDS[i]!
  const groups: Record<string, string[]> = {}
  for (const [variant, map] of Object.entries(listings)) {
    groups[variant] = [...map].filter(([, tools]) => [...tools].some((tool) => need.tools.some((prefix) => tool.startsWith(prefix)))).map(([name]) => name)
    if (groups[variant]!.length === 0) throw new Error(`${need.id}: no ${variant} group holds ${need.tools.join(', ')}`)
  }
  return { id: need.id, writer: task.writer, product: task.product, task: task.task, tools: need.tools, groups }
})
writeFileSync('scripts/select-v3.json', JSON.stringify(result, null, 2) + '\n')
for (const r of result) console.log(`${r.id}: opt2 [${r.groups['opt2']!.join(', ')}] opt2-rec [${r.groups['opt2-rec']!.join(', ')}]`)
