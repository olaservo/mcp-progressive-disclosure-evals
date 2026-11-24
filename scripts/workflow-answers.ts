// Builds the workflow tasks' answer key. Each step of a task names the tools that do it, by name prefix, chosen from the
// catalog's tool names and descriptions with the writer's step list beside them, before any model is run on the tasks.
// A step is optional when the job can be done without it. A task whose steps fit fewer than three tools is dropped.
// `exists` names the resources the task speaks of as already there, which the runner's made-up list results return.
// Checks every prefix against the catalog as served and prints scripts/workflow-tasks.json.
// Usage: tsx scripts/workflow-answers.ts [--url <flat mcp url>]
import { readFileSync, writeFileSync } from 'node:fs'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const url = args.includes('--url') ? args[args.indexOf('--url') + 1]! : 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp'

type Need = { does: string; tools: string[]; stated: boolean; optional?: true }
const step = (does: string, stated: boolean, ...tools: string[]): Need => ({ does, tools, stated })
const optional = (does: string, stated: boolean, ...tools: string[]): Need => ({ does, tools, stated, optional: true })
// The runner gives no zone ID, so a job on a named zone can start with a lookup. No writer listed it on every such task.
const ZONE = optional('look up the zone by name', false, 'zones_list', 'zones_get')
const SCRIPT_SETTINGS_GET = ['workers_legacy_scripts_settings_get', 'workers_get']
const SCRIPT_SETTINGS_EDIT = ['workers_legacy_scripts_settings_edit', 'workers_legacy_scripts_scriptAndVersionSettings_edit', 'workers_edit', 'workers_update', 'workers_versions_latest_edit']

/** In results/tasks-workflow/tasks.json order. `drop` gives the reason a task is left out. */
const NEEDS: ({ id: string; exists: string[]; steps: Need[] } | { id: string; drop: string })[] = [
  {
    id: 'retire-subdomain',
    exists: ['acmeshop.io', 'news.acmeshop.io'],
    steps: [
      ZONE,
      step('find the old sending subdomain', false, 'emailSending_subdomains_list'),
      step('delete it', true, 'emailSending_subdomains_delete'),
      step('create the new one', true, 'emailSending_subdomains_create'),
      step('get its DNS records', true, 'emailSending_subdomains_dns')
    ]
  },
  {
    id: 'script-config',
    exists: ['data-processor', 'example.com'],
    steps: [
      optional('read the script', false, ...SCRIPT_SETTINGS_GET, 'workers_list'),
      step('set the secret', true, 'workers_secrets_update', 'workers_secrets_bulk'),
      step('attach the domain', true, 'workers_domains_update'),
      step('set the cron schedule', true, 'workers_scripts_schedules_update')
    ]
  },
  {
    id: 'leaking-container',
    exists: ['pdf-renderer'],
    steps: [
      step('find the container app', true, 'containers_applications_list', 'containers_applications_get'),
      step('find the namespace and the script that owns it', false, 'durableObjects_namespaces_list'),
      step('count the objects in it', true, 'durableObjects_namespaces_objects_list'),
      step("read the script's bindings", true, ...SCRIPT_SETTINGS_GET)
    ]
  },
  {
    id: 'forwarding-setup',
    exists: ['standard-corp.com'],
    steps: [
      ZONE,
      step('register the destination address', true, 'emailRouting_addresses_create'),
      step('turn forwarding on for the zone', true, 'emailRouting_enable', 'emailRouting_settings_get'),
      step('create the forwarding rule', true, 'emailRouting_rules_create')
    ]
  },
  {
    id: 'branch-appliance',
    exists: ['7KX2-MC-00418'],
    steps: [
      step('find the appliance by serial number', false, 'connectors_list'),
      step('list its events', true, 'connectorTelemetryEvents_list'),
      step('get its latest snapshot', true, 'connectorTelemetrySnapshots_'),
      step('move its maintenance window', true, 'connectorInterrupts_create', 'connectors_edit', 'connectors_update')
    ]
  },
  { id: 'total-tls', drop: 'the catalog has no fallback certificate tool, so the job fits two tools, acm_totalTls_get and acm_totalTls_edit' },
  {
    id: 'share-ruleset',
    exists: ['corp-baseline-blocks', 'Acme Staging'],
    steps: [
      step('find the ruleset', false, 'rulesets_list'),
      step('find the other account', false, 'accounts_list', 'organization_account_list'),
      step('create the share', true, 'resourceSharing_create')
    ]
  },
  { id: 'lookalike-monitor', drop: 'the catalog has no tool that deletes a saved query or submits a URL for scanning, so the job fits two tools' },
  {
    id: 'org-invite',
    exists: ['Acme Ops', 'Infrastructure Admin'],
    // The writer's role lookup is left out: the catalog has no tool that lists organization roles.
    steps: [
      step('find the organization', false, 'organization_list'),
      step('add the member', true, 'organization_member_create', 'organization_member_batch_create'),
      step('read the audit log', true, 'organizations_logs_audit')
    ]
  },
  {
    id: 'tenant-binding',
    exists: ['acme-store', 'production-tenants', 'shared-config'],
    steps: [
      step('find the key-value namespace', false, 'kv_namespaces_list'),
      step("read the script's bindings", false, 'workersForPlatforms_dispatchNamespaces_scripts_bindings_get', 'workersForPlatforms_dispatchNamespaces_scripts_settings_get', 'workersForPlatforms_dispatchNamespaces_scripts_get'),
      step('add the binding', true, 'workersForPlatforms_dispatchNamespaces_scripts_settings_edit'),
      step('add the secret', true, 'workersForPlatforms_dispatchNamespaces_scripts_secrets_update', 'workersForPlatforms_dispatchNamespaces_scripts_secrets_bulk')
    ]
  },
  {
    id: 'alert-webhook',
    exists: ['Production Error Spike'],
    steps: [
      step('create the webhook destination', true, 'alerting_destinations_webhooks_create'),
      step('find the policy', false, 'alerting_policies_list'),
      step('attach the destination to it', true, 'alerting_policies_update'),
      step('create the silence', true, 'alerting_silences_create')
    ]
  },
  {
    id: 'failed-deploy',
    exists: ['marketing-site'],
    steps: [
      step("list the project's deployments", false, 'pages_deployments_list'),
      step('get the build log', true, 'pages_deployments_history_logs_get'),
      step('roll back', true, 'pages_deployments_rollback'),
      step('attach the domain', true, 'pages_domains_create')
    ]
  },
  {
    id: 'scan-and-block',
    exists: ['example-corp.com'],
    steps: [
      step('start the scan', true, 'urlScanner_scans_create'),
      step('get the report', true, 'urlScanner_scans_get'),
      ZONE,
      step('block the address on the zone', true, 'firewall_accessRules_create', 'rulesets_rules_create', 'rulesets_update')
    ]
  },
  {
    id: 'flag-binding',
    exists: ['storefront', 'checkout-api'],
    steps: [
      step('find the flag app', false, 'flagship_apps_list'),
      step('create the flag', true, 'flagship_apps_flags_create'),
      step("read the script's bindings", false, ...SCRIPT_SETTINGS_GET),
      step('add the binding', true, ...SCRIPT_SETTINGS_EDIT)
    ]
  },
  {
    id: 'traffic-monitoring',
    exists: ['High Traffic Warning'],
    steps: [
      step('find the rule', false, 'magicNetworkMonitoring_rules_list'),
      step('change its threshold', true, 'magicNetworkMonitoring_rules_edit', 'magicNetworkMonitoring_rules_update'),
      step('read the configuration', false, 'magicNetworkMonitoring_configs_get', 'magicNetworkMonitoring_configs_full_get'),
      step('add the router address', true, 'magicNetworkMonitoring_configs_edit', 'magicNetworkMonitoring_configs_update')
    ]
  },
  {
    id: 'wipe-cache-store',
    exists: ['shop.example.com', 'example.com'],
    steps: [
      ZONE,
      step('turn the store off, which a wipe needs', false, 'cache_settings_reserve_edit'),
      step('start the wipe', true, 'cache_settings_reserve_clear'),
      step('read the wipe status', true, 'cache_settings_reserve_status'),
      step('turn on the upper-tier selection', true, 'cache_settings_smartTieredCache_edit', 'cache_settings_smartTieredCache_create')
    ]
  },
  {
    id: 'record-to-tunnel',
    exists: ['acmeparts.com', 'inventory.acmeparts.com', 'warehouse-edge'],
    steps: [
      ZONE,
      step('find the tunnel', false, 'tunnels_list', 'tunnel_list'),
      step('find the record', false, 'dns_records_list'),
      step('replace it', true, 'dns_records_update', 'dns_records_edit')
    ]
  },
  {
    id: 'abuse-block',
    exists: ['example.com', 'AB-94821'],
    steps: [
      ZONE,
      step('find the report', true, 'abuseReports_list'),
      step('read the report for the address', false, 'abuseReports_get'),
      step('block the address on the zone', true, 'firewall_accessRules_create', 'rulesets_rules_create', 'rulesets_update')
    ]
  },
  {
    id: 'tag-trigger',
    exists: ['example.com'],
    steps: [
      ZONE,
      step('check workflow mode', true, 'zaraz_workflow_get'),
      step('read the configuration', false, 'zaraz_config_get'),
      step('add the trigger', true, 'zaraz_config_update'),
      step('publish', true, 'zaraz_publish_create')
    ]
  },
  {
    id: 'vector-index',
    exists: ['search-service'],
    steps: [
      step('create the index', true, 'vectorize_create'),
      step("read the script's bindings", false, ...SCRIPT_SETTINGS_GET),
      step('add the binding', true, ...SCRIPT_SETTINGS_EDIT),
      step('insert the vector', true, 'vectorize_insert', 'vectorize_upsert')
    ]
  }
]

type Written = { writer: string; product: string; kind: 'single' | 'cross'; task: string; products?: string[]; steps: { does: string; stated: boolean; product?: string }[] }
const written = JSON.parse(readFileSync('results/tasks-workflow/tasks.json', 'utf8')) as Written[]
if (written.length !== NEEDS.length) throw new Error('NEEDS and tasks.json differ in length')

const mcp = new Client({ name: 'groups-workflow-answers', version: '0.1.0' }, { versionNegotiation: { mode: 'auto' } })
await mcp.connect(new StreamableHTTPClientTransport(new URL(url)))
const names: string[] = []
let cursor: string | undefined
do {
  const page = await mcp.listTools(cursor ? { cursor } : undefined)
  names.push(...page.tools.map((tool) => tool.name))
  cursor = page.nextCursor
} while (cursor)
await mcp.close()

const prefixOf = (name: string) => name.split('_')[0]!
const out = []
for (const [at, need] of NEEDS.entries()) {
  const task = written[at]!
  if ('drop' in need) {
    console.error(`dropped ${need.id} (${task.product}, ${task.writer}): ${need.drop}`)
    continue
  }
  for (const entry of need.steps.flatMap((s) => s.tools)) if (!names.some((name) => name.startsWith(entry))) throw new Error(`${need.id}: no tool starts with ${entry}`)
  const required = need.steps.filter((s) => !s.optional)
  if (required.length < 3) throw new Error(`${need.id}: fewer than three required steps`)
  // The products of the required steps, from the tool names. A `single` task can still span several.
  const prefixes = [...new Set(required.flatMap((s) => s.tools.map(prefixOf)))]
  out.push({ id: need.id, product: task.product, kind: task.kind, writer: task.writer, task: task.task, prefixes, exists: need.exists, steps: need.steps, writerSteps: task.steps })
  console.error(`${need.id} | ${task.kind} | ${required.length} required, ${required.filter((s) => !s.stated).length} unsaid | ${prefixes.join(' ')}`)
}
writeFileSync(new URL('./workflow-tasks.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.error(`${out.length} tasks in scripts/workflow-tasks.json`)
