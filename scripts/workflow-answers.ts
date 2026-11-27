// Builds the workflow tasks' answer key. Each step of a task names the tools that do it, by name prefix, chosen from the
// catalog's tool names and descriptions with the writer's step list beside them.
// A lookup is a required step when a later tool's path takes an ID the task does not give. Other reads are optional unless
// the task asks to keep what is there. A task whose steps fit fewer than three tools is dropped.
// `world` is what the account holds for the task: the result the runner returns for a tool, by name prefix. It gives a
// lookup the named resource with an ID, and a read the fields a later step needs.
// The key was revised on 2026-11-24 after the first run, whose results showed the made-up results stopping trials: `world`
// replaced a flat list of names, zone lookups became required where a zone-scoped tool is, the two abuse report steps
// became one, and the read before the vector index binding became optional.
// Revised again after the second run and the Opus run, from the calls made in trials that missed a step: a settings edit
// or a version upload can add a binding or a secret, a bulk submit starts a scan, a settings update turns forwarding on,
// and the user's memberships give the other account. `world` now answers the organization and membership lists.
// Checks every prefix against the catalog as served and prints tasks/workflow-tasks.json.
// Usage: tsx scripts/workflow-answers.ts [--url <flat mcp url>]
import { readFileSync, writeFileSync } from 'node:fs'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

const args = process.argv.slice(2)
const url = args.includes('--url') ? args[args.indexOf('--url') + 1]! : 'https://pd-groups-flat-full.olahungerford.workers.dev/mcp'

type Need = { does: string; tools: string[]; stated: boolean; optional?: true }
const step = (does: string, stated: boolean, ...tools: string[]): Need => ({ does, tools, stated })
const optional = (does: string, stated: boolean, ...tools: string[]): Need => ({ does, tools, stated, optional: true })
const ZONE = step('look up the zone by name', false, 'zones_list', 'zones_get')
const SCRIPT_SETTINGS_GET = ['workers_legacy_scripts_settings_get', 'workers_legacy_scripts_scriptAndVersionSettings_get', 'workers_get']
const SCRIPT_SETTINGS_EDIT = ['workers_legacy_scripts_settings_edit', 'workers_legacy_scripts_scriptAndVersionSettings_edit', 'workers_edit', 'workers_update', 'workers_versions_latest_edit', 'workers_legacy_scripts_versions_create']

const zone = (name: string, id: string) => ({ zones_list: [{ id, name, status: 'active', type: 'full' }], zones_get: { id, name, status: 'active', type: 'full' } })
const script = (name: string, bindings: unknown[]) => ({
  workers_list: [{ id: name, name, created_on: '2026-08-11T09:02:00Z' }],
  workers_get: { id: name, name, created_on: '2026-08-11T09:02:00Z' },
  workers_legacy_scripts_settings_get: { bindings, logpush: false, tail_consumers: [] },
  workers_legacy_scripts_scriptAndVersionSettings_get: { bindings, compatibility_date: '2026-06-01', usage_model: 'standard' }
})

type World = Record<string, unknown>
/** In results/tasks/workflow/tasks.json order. `drop` gives the reason a task is left out. */
const NEEDS: ({ id: string; world: World; steps: Need[] } | { id: string; drop: string })[] = [
  {
    id: 'retire-subdomain',
    world: {
      ...zone('acmeshop.io', '6b1e0c4f9a2d4e7f8c3b5a1d0e9f2c47'),
      emailSending_subdomains_list: [{ tag: 'a41c7e90b2d34f6588e1c0d97a3b5f12', name: 'news.acmeshop.io', enabled: true, created: '2026-03-04T10:00:00Z' }],
      emailSending_subdomains_get: { tag: 'a41c7e90b2d34f6588e1c0d97a3b5f12', name: 'news.acmeshop.io', enabled: true },
      emailSending_subdomains_delete: { tag: 'a41c7e90b2d34f6588e1c0d97a3b5f12' },
      emailSending_subdomains_create: { tag: 'c93d2b70e1f84a6a9d2e7b4c5f6a8e01', name: 'mail.acmeshop.io', enabled: true, created: '2026-11-24T10:00:00Z' },
      emailSending_subdomains_dns: [
        { type: 'MX', name: 'cf-bounce.mail.acmeshop.io', content: 'route1.mx.cloudflare.net', priority: 10, ttl: 1 },
        { type: 'TXT', name: 'cf-bounce.mail.acmeshop.io', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all', ttl: 1 },
        { type: 'TXT', name: 'cf2024-1._domainkey.mail.acmeshop.io', content: 'v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA', ttl: 1 }
      ]
    },
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
    world: { ...zone('example.com', '2d7f1a9c4e6b4f0a8c5d3e1b9a7f6c20'), ...script('data-processor', [{ type: 'plain_text', name: 'ENVIRONMENT', text: 'production' }]), workers_scripts_schedules_get: { schedules: [{ cron: '*/30 * * * *' }] } },
    steps: [
      optional('read the script', false, ...SCRIPT_SETTINGS_GET, 'workers_list'),
      step('set the secret', true, 'workers_secrets_update', 'workers_secrets_bulk', ...SCRIPT_SETTINGS_EDIT),
      step('attach the domain', true, 'workers_domains_update'),
      step('set the cron schedule', true, 'workers_scripts_schedules_update')
    ]
  },
  {
    id: 'leaking-container',
    world: {
      ...script('pdf-renderer-worker', [{ type: 'durable_object_namespace', name: 'RENDERER', class_name: 'PdfRenderer', namespace_id: '5f0e3c1a7b9d4e2f8a6c4b0d1e3f5a79' }, { type: 'r2_bucket', name: 'OUTPUT', bucket_name: 'rendered-pdfs' }]),
      containers_applications: [{ id: 'e7a1c3b5-9d2f-4e6a-8c0b-1d3f5a7c9e2b', name: 'pdf-renderer', instances: 37, max_instances: 40, configuration: { image: 'registry.cloudflare.com/4f1c2a9e/pdf-renderer:1.8.2', instance_type: 'basic' }, durable_objects: { namespace_id: '5f0e3c1a7b9d4e2f8a6c4b0d1e3f5a79' } }],
      containers_applications_get: { id: 'e7a1c3b5-9d2f-4e6a-8c0b-1d3f5a7c9e2b', name: 'pdf-renderer', instances: 37, max_instances: 40, configuration: { image: 'registry.cloudflare.com/4f1c2a9e/pdf-renderer:1.8.2', instance_type: 'basic' }, durable_objects: { namespace_id: '5f0e3c1a7b9d4e2f8a6c4b0d1e3f5a79' } },
      durableObjects_namespaces_list: [{ id: '5f0e3c1a7b9d4e2f8a6c4b0d1e3f5a79', name: 'pdf-renderer-worker_PdfRenderer', script: 'pdf-renderer-worker', class: 'PdfRenderer', use_sqlite: true, use_containers: true }],
      durableObjects_namespaces_objects_list: Array.from({ length: 41 }, (_, at) => ({ id: `${(at + 1).toString(16).padStart(4, '0')}c0ffee5f0e3c1a7b9d4e2f8a6c4b0d1e3f5a79000000000000000000`.slice(0, 64), hasStoredData: true }))
    },
    steps: [
      step('find the container app', true, 'containers_applications_list', 'containers_applications_get'),
      step('find the namespace and the script that owns it', false, 'durableObjects_namespaces_list'),
      step('count the objects in it', true, 'durableObjects_namespaces_objects_list'),
      step("read the script's bindings", true, ...SCRIPT_SETTINGS_GET)
    ]
  },
  {
    id: 'forwarding-setup',
    world: {
      ...zone('standard-corp.com', '8c2a4e6f0b1d4c3e9a7f5d3b1c0e2a46'),
      emailRouting_settings_get: { id: '75610dab9e69410a82cf7e400a09ecec', name: 'standard-corp.com', enabled: false, status: 'unconfigured' },
      emailRouting_enable: { id: '75610dab9e69410a82cf7e400a09ecec', name: 'standard-corp.com', enabled: true, status: 'ready' },
      emailRouting_settings_apply: { id: '75610dab9e69410a82cf7e400a09ecec', name: 'standard-corp.com', enabled: true, status: 'ready' },
      emailRouting_settings_update: { id: '75610dab9e69410a82cf7e400a09ecec', name: 'standard-corp.com', enabled: true, status: 'ready' },
      emailRouting_addresses_list: [],
      emailRouting_addresses_create: { id: 'ea95132c15732412d22c1476fa83f27a', email: 'dev-team@externaldomain.com', verified: null, created: '2026-11-24T10:00:00Z' }
    },
    steps: [
      ZONE,
      step('register the destination address', true, 'emailRouting_addresses_create'),
      step('turn forwarding on for the zone', true, 'emailRouting_enable', 'emailRouting_settings_get', 'emailRouting_settings_apply', 'emailRouting_settings_update'),
      step('create the forwarding rule', true, 'emailRouting_rules_create')
    ]
  },
  {
    id: 'branch-appliance',
    world: {
      connectors_list: [{ id: '3d9b7f15c2a84e60b1d4f8a6c0e2b579', activated: true, interrupt_window_duration_hours: 1, interrupt_window_hour_of_day: 1, notes: 'Lisbon branch', timezone: 'Europe/Lisbon', device: { id: '9a1c3e5b7d0f4a2c8e6b4d2f0a1c3e58', serial_number: '7KX2-MC-00418' } }],
      connectors_get: { id: '3d9b7f15c2a84e60b1d4f8a6c0e2b579', activated: true, interrupt_window_duration_hours: 1, interrupt_window_hour_of_day: 1, notes: 'Lisbon branch', timezone: 'Europe/Lisbon', device: { id: '9a1c3e5b7d0f4a2c8e6b4d2f0a1c3e58', serial_number: '7KX2-MC-00418' } },
      connectorTelemetryEvents_list: { count: 3, items: [{ a: 1763935200.0, k: 'StartRotateCryptKey', n: 0, t: 1763935200.0 }, { a: 1763938920.0, k: 'Reboot', n: 0, t: 1763938920.0 }, { a: 1763942400.0, k: 'StartUpgrade', n: 0, t: 1763942400.0 }] },
      connectorTelemetryEvents_get: { e: { k: 'Reboot' }, n: 0, t: 1763938920.0, v: '0.0.2' },
      connectorTelemetrySnapshots_list: { count: 1, items: [{ a: 1763971200.0, t: 1763971200.0 }] },
      connectorTelemetrySnapshots_get: { count_reclaim_failures: 0, cpu_count: 4, cpu_load_average_1m: 3.8, memory_available_kb: 180432, memory_total_kb: 8048128, uptime_seconds: 31400, tunnels: [{ health_state: 'down', interface_name: 'ipsec1' }], v: '2026.10.1' }
    },
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
    world: {
      rulesets_list: [
        { id: '2f2feab2026849078ba485f918791bdc', name: 'default', kind: 'zone', phase: 'http_request_firewall_custom', version: '4' },
        { id: 'b7c1e9a3d5f04b2a86c4e0d2f1a3b5c7', name: 'corp-baseline-blocks', kind: 'custom', phase: 'http_request_firewall_custom', version: '12' }
      ],
      accounts_list: [
        { id: '4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a', name: 'Acme Production', type: 'enterprise' },
        { id: 'd0a2c4e6f8b14d3c9e7a5f3b1d0c2e48', name: 'Acme Staging', type: 'enterprise' }
      ],
      organization_account_list: [
        { id: '4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a', name: 'Acme Production' },
        { id: 'd0a2c4e6f8b14d3c9e7a5f3b1d0c2e48', name: 'Acme Staging' }
      ],
      organization_list: [{ id: 'a7b9c1d3e5f74a6c8e0b2d4f6a8c0e13', name: 'Acme', create_time: '2025-02-03T08:00:00Z' }],
      accounts_organizations_list: [{ id: 'a7b9c1d3e5f74a6c8e0b2d4f6a8c0e13', name: 'Acme', create_time: '2025-02-03T08:00:00Z' }],
      user_memberships_list: [
        { id: '4536bcfad5faccb111b47003c79917fa', status: 'accepted', account: { id: '4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a', name: 'Acme Production' }, roles: ['Administrator'] },
        { id: '9b2d4f6a8c0e4a1c3e5b7d9f1a3c5e70', status: 'accepted', account: { id: 'd0a2c4e6f8b14d3c9e7a5f3b1d0c2e48', name: 'Acme Staging' }, roles: ['Administrator'] }
      ],
      resourceSharing_list: []
    },
    steps: [
      step('find the ruleset', false, 'rulesets_list'),
      step('find the other account', false, 'accounts_list', 'organization_account_list', 'user_memberships_list'),
      step('create the share', true, 'resourceSharing_create')
    ]
  },
  { id: 'lookalike-monitor', drop: 'the catalog has no tool that deletes a saved query or submits a URL for scanning, so the job fits two tools' },
  {
    id: 'org-invite',
    // The writer's role lookup is left out: the catalog has no tool that lists organization roles.
    world: {
      organization_list: [{ id: 'a7b9c1d3e5f74a6c8e0b2d4f6a8c0e13', name: 'Acme Ops', create_time: '2025-02-03T08:00:00Z' }],
      organization_get: { id: 'a7b9c1d3e5f74a6c8e0b2d4f6a8c0e13', name: 'Acme Ops', create_time: '2025-02-03T08:00:00Z' },
      organization_member_list: [{ id: 'f1e3d5c7b9a04f2e8d6c4b2a0f1e3d59', status: 'active', user: { email: 'cto@acme.org' } }],
      organization_member_create: { id: 'c5d7e9f1a3b54c6e8a0c2e4f6b8d0a27', status: 'pending', user: { email: 'ops-lead@acme.org' }, create_time: '2026-11-24T10:00:00Z' },
      organizations_logs_audit: [{ id: 'f174be97-19b1-40d6-954d-70cd5fbd52db', action: { type: 'create', result: 'success', time: '2026-11-24T10:00:01Z' }, actor: { email: 'admin@acme.org', type: 'user' }, resource: { type: 'organization.member', id: 'c5d7e9f1a3b54c6e8a0c2e4f6b8d0a27' } }]
    },
    steps: [
      step('find the organization', false, 'organization_list'),
      step('add the member', true, 'organization_member_create', 'organization_member_batch_create'),
      step('read the audit log', true, 'organizations_logs_audit')
    ]
  },
  {
    id: 'tenant-binding',
    world: {
      kv_namespaces_list: [
        { id: '0f2ac74b498b48028cb68387c421e279', title: 'sessions', supports_url_encoding: true },
        { id: '7c9e1b3d5f704a2e8c6a4e2f0b1d3c58', title: 'shared-config', supports_url_encoding: true }
      ],
      workersForPlatforms_dispatchNamespaces_scripts_bindings_get: [{ type: 'plain_text', name: 'TENANT', text: 'acme-store' }, { type: 'r2_bucket', name: 'ASSETS', bucket_name: 'acme-store-assets' }],
      workersForPlatforms_dispatchNamespaces_scripts_settings_get: { bindings: [{ type: 'plain_text', name: 'TENANT', text: 'acme-store' }, { type: 'r2_bucket', name: 'ASSETS', bucket_name: 'acme-store-assets' }], compatibility_date: '2026-06-01' },
      workersForPlatforms_dispatchNamespaces_scripts_get: { id: 'acme-store', dispatch_namespace: 'production-tenants', created_on: '2026-05-19T12:00:00Z' },
      workersForPlatforms_dispatchNamespaces_scripts_secrets_list: []
    },
    steps: [
      step('find the key-value namespace', false, 'kv_namespaces_list'),
      step("read the script's bindings", false, 'workersForPlatforms_dispatchNamespaces_scripts_bindings_get', 'workersForPlatforms_dispatchNamespaces_scripts_settings_get', 'workersForPlatforms_dispatchNamespaces_scripts_get'),
      step('add the binding', true, 'workersForPlatforms_dispatchNamespaces_scripts_settings_edit'),
      step('add the secret', true, 'workersForPlatforms_dispatchNamespaces_scripts_secrets_update', 'workersForPlatforms_dispatchNamespaces_scripts_secrets_bulk', 'workersForPlatforms_dispatchNamespaces_scripts_settings_edit')
    ]
  },
  {
    id: 'alert-webhook',
    world: {
      alerting_destinations_webhooks_list: [],
      alerting_destinations_webhooks_create: { id: 'b115d5ec15c641ee8b7692c449b5227b' },
      alerting_policies_list: [{ id: '0da2b59ef118439d8097bdfb215203c9', name: 'Production Error Spike', enabled: true, alert_type: 'http_alert_origin_error', mechanisms: { email: [{ id: 'oncall@acme.org' }] }, filters: { zones: ['2d7f1a9c4e6b4f0a8c5d3e1b9a7f6c20'] } }],
      alerting_policies_get: { id: '0da2b59ef118439d8097bdfb215203c9', name: 'Production Error Spike', enabled: true, alert_type: 'http_alert_origin_error', mechanisms: { email: [{ id: 'oncall@acme.org' }] }, filters: { zones: ['2d7f1a9c4e6b4f0a8c5d3e1b9a7f6c20'] } },
      alerting_policies_update: { id: '0da2b59ef118439d8097bdfb215203c9' },
      alerting_silences_list: []
    },
    steps: [
      step('create the webhook destination', true, 'alerting_destinations_webhooks_create'),
      step('find the policy', false, 'alerting_policies_list'),
      step('attach the destination to it', true, 'alerting_policies_update'),
      step('create the silence', true, 'alerting_silences_create')
    ]
  },
  {
    id: 'failed-deploy',
    world: {
      pages_list: [{ id: '7b162ea7-7367-4d67-bcde-1160995d5ad0', name: 'marketing-site', production_branch: 'main', subdomain: 'marketing-site.pages.dev' }],
      pages_get: { id: '7b162ea7-7367-4d67-bcde-1160995d5ad0', name: 'marketing-site', production_branch: 'main', subdomain: 'marketing-site.pages.dev', domains: ['marketing-site.pages.dev'] },
      pages_deployments_list: [
        { id: 'f64788e9-fccd-4d4a-a28a-cb84f88f6c11', environment: 'production', created_on: '2026-11-24T08:41:00Z', latest_stage: { name: 'build', status: 'failure' }, deployment_trigger: { metadata: { branch: 'main', commit_message: 'Update pricing table' } } },
        { id: '0a3c5e7b-9d1f-4b2d-8e6a-4c2e0f1a3b5d', environment: 'production', created_on: '2026-11-21T15:02:00Z', latest_stage: { name: 'deploy', status: 'success' }, deployment_trigger: { metadata: { branch: 'main', commit_message: 'Add holiday banner' } } },
        { id: '5d7f9b1c-3e0a-4c6e-9a8b-6d4f2b0c1e3a', environment: 'production', created_on: '2026-11-18T11:30:00Z', latest_stage: { name: 'deploy', status: 'success' }, deployment_trigger: { metadata: { branch: 'main', commit_message: 'Fix footer links' } } }
      ],
      pages_deployments_get: { id: 'f64788e9-fccd-4d4a-a28a-cb84f88f6c11', environment: 'production', created_on: '2026-11-24T08:41:00Z', latest_stage: { name: 'build', status: 'failure' } },
      pages_deployments_history_logs_get: { total: 4, includes_container_logs: true, data: [{ ts: '2026-11-24T08:41:12Z', line: 'Installing dependencies' }, { ts: '2026-11-24T08:42:03Z', line: 'Executing user command: npm run build' }, { ts: '2026-11-24T08:42:19Z', line: "Error: Cannot find module './components/PricingTable'" }, { ts: '2026-11-24T08:42:20Z', line: 'Failed: build command exited with code: 1' }] },
      pages_deployments_rollback: { id: '0a3c5e7b-9d1f-4b2d-8e6a-4c2e0f1a3b5d', environment: 'production', latest_stage: { name: 'deploy', status: 'success' } },
      pages_domains_list: []
    },
    steps: [
      step("list the project's deployments", false, 'pages_deployments_list'),
      step('get the build log', true, 'pages_deployments_history_logs_get'),
      step('roll back', true, 'pages_deployments_rollback'),
      step('attach the domain', true, 'pages_domains_create')
    ]
  },
  {
    id: 'scan-and-block',
    world: {
      ...zone('example-corp.com', '1e3a5c7f9b0d4e2a8c6f4b2d0a1c3e57'),
      urlScanner_scans_create: { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f', api: 'https://api.cloudflare.com/client/v4/accounts/4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a/urlscanner/v2/result/095be615-a8ad-4c33-8e9c-c7612fbf6c9f', url: 'https://test.example-corp.com/welcome', visibility: 'public', message: 'Submission successful' },
      urlScanner_scans_bulkCreate: [{ uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f', api: 'https://api.cloudflare.com/client/v4/accounts/4f1c2a9e7b3d4c5e8a6f0b1d2c3e4f5a/urlscanner/v2/result/095be615-a8ad-4c33-8e9c-c7612fbf6c9f', url: 'https://test.example-corp.com/welcome', visibility: 'public' }],
      urlScanner_scans_get: { task: { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f', url: 'https://test.example-corp.com/welcome', status: 'finished', visibility: 'public' }, page: { url: 'https://test.example-corp.com/welcome', domain: 'test.example-corp.com', ip: '203.0.113.77', asn: 'AS64500', country: 'NL', status: '200' }, verdicts: { overall: { malicious: false } }, stats: { requests: 23 } },
      urlScanner_scans_list: [{ task: { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f', url: 'https://test.example-corp.com/welcome', time: '2026-11-24T10:00:00Z' }, page: { ip: '203.0.113.77' } }],
      firewall_accessRules_list: []
    },
    steps: [
      step('start the scan', true, 'urlScanner_scans_create', 'urlScanner_scans_bulkCreate'),
      step('get the report', true, 'urlScanner_scans_get'),
      ZONE,
      step('block the address on the zone', true, 'firewall_accessRules_create', 'rulesets_rules_create', 'rulesets_update')
    ]
  },
  {
    id: 'flag-binding',
    world: {
      ...script('checkout-api', [{ type: 'kv_namespace', name: 'CART_CACHE', namespace_id: '0f2ac74b498b48028cb68387c421e279' }, { type: 'secret_text', name: 'STRIPE_KEY' }]),
      flagship_apps_list: [{ id: '6e8a0c2e-4f6b-4d0a-8c1e-3a5c7e9b1d3f', name: 'storefront', created_at: '2026-07-02T09:00:00Z' }],
      flagship_apps_get: { id: '6e8a0c2e-4f6b-4d0a-8c1e-3a5c7e9b1d3f', name: 'storefront', created_at: '2026-07-02T09:00:00Z' },
      flagship_apps_flags_list: []
    },
    steps: [
      step('find the flag app', false, 'flagship_apps_list'),
      step('create the flag', true, 'flagship_apps_flags_create'),
      step("read the script's bindings", false, ...SCRIPT_SETTINGS_GET),
      step('add the binding', true, ...SCRIPT_SETTINGS_EDIT)
    ]
  },
  {
    id: 'traffic-monitoring',
    world: {
      magicNetworkMonitoring_rules_list: [
        { id: '2890e6fa406311ed9b5a23f70f6fb8cf', name: 'High Traffic Warning', bandwidth_threshold: 250000, duration: '1m', prefixes: ['203.0.113.0/24'], automatic_advertisement: false },
        { id: '9c1e3a5b7d2f4e6a8b0c2d4e6f8a0b1c', name: 'Volumetric Critical', packet_threshold: 80000, duration: '1m', prefixes: ['203.0.113.0/24'], automatic_advertisement: true }
      ],
      magicNetworkMonitoring_rules_get: { id: '2890e6fa406311ed9b5a23f70f6fb8cf', name: 'High Traffic Warning', bandwidth_threshold: 250000, duration: '1m', prefixes: ['203.0.113.0/24'], automatic_advertisement: false },
      magicNetworkMonitoring_configs_get: { name: 'acme-flow-monitoring', default_sampling: 1, router_ips: ['198.51.100.7', '198.51.100.8'], warp_devices: [] },
      magicNetworkMonitoring_configs_full_get: { name: 'acme-flow-monitoring', default_sampling: 1, router_ips: ['198.51.100.7', '198.51.100.8'], warp_devices: [] }
    },
    steps: [
      step('find the rule', false, 'magicNetworkMonitoring_rules_list'),
      step('change its threshold', true, 'magicNetworkMonitoring_rules_edit', 'magicNetworkMonitoring_rules_update'),
      step('read the configuration', false, 'magicNetworkMonitoring_configs_get', 'magicNetworkMonitoring_configs_full_get'),
      step('add the router address', true, 'magicNetworkMonitoring_configs_edit', 'magicNetworkMonitoring_configs_update')
    ]
  },
  {
    id: 'wipe-cache-store',
    world: {
      zones_list: [{ id: '9f0b2d4c6e8a4b1c7d5f3a1e0c2b4d68', name: 'shop.example.com', status: 'active', type: 'full' }],
      zones_get: { id: '9f0b2d4c6e8a4b1c7d5f3a1e0c2b4d68', name: 'shop.example.com', status: 'active', type: 'full' },
      cache_settings_reserve_get: { id: 'cache_reserve', value: 'on', editable: true, modified_on: '2026-09-01T12:00:00Z' },
      cache_settings_reserve_edit: { id: 'cache_reserve', value: 'off', editable: true, modified_on: '2026-11-24T10:00:00Z' },
      cache_settings_reserve_clear: { id: 'cache_reserve_clear', state: 'In-progress', start_ts: '2026-11-24T10:00:05Z' },
      cache_settings_reserve_status: { id: 'cache_reserve_clear', state: 'In-progress', start_ts: '2026-11-24T10:00:05Z' },
      cache_settings_smartTieredCache_get: { id: 'tiered_cache_smart_topology_enable', value: 'off', editable: true }
    },
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
    world: {
      ...zone('acmeparts.com', '3ace13f51486a04ebf4f7ad4258c0e1e'),
      tunnels_list: [{ id: 'c1744f8b-faa1-48a4-9e5c-02ac921467fa', name: 'warehouse-edge', status: 'healthy', tun_type: 'cfd_tunnel', created_at: '2026-04-12T07:30:00Z' }],
      tunnel_list: [{ id: 'c1744f8b-faa1-48a4-9e5c-02ac921467fa', name: 'warehouse-edge', status: 'healthy', tun_type: 'cfd_tunnel', created_at: '2026-04-12T07:30:00Z' }],
      tunnels_get: { id: 'c1744f8b-faa1-48a4-9e5c-02ac921467fa', name: 'warehouse-edge', status: 'healthy', tun_type: 'cfd_tunnel' },
      dns_records_list: [{ id: '89c0c7a1e3b54d2f9a6c8e0b2d4f6a13', type: 'A', name: 'inventory.acmeparts.com', content: '198.51.100.24', proxied: false, ttl: 300, comment: '' }],
      dns_records_get: { id: '89c0c7a1e3b54d2f9a6c8e0b2d4f6a13', type: 'A', name: 'inventory.acmeparts.com', content: '198.51.100.24', proxied: false, ttl: 300, comment: '' }
    },
    steps: [
      ZONE,
      step('find the tunnel', false, 'tunnels_list', 'tunnel_list'),
      step('find the record', false, 'dns_records_list'),
      step('replace it', true, 'dns_records_update', 'dns_records_edit')
    ]
  },
  {
    id: 'abuse-block',
    world: {
      ...zone('example.com', '2d7f1a9c4e6b4f0a8c5d3e1b9a7f6c20'),
      abuseReports_list: { reports: [{ id: 'AB-94821', cdate: '2026-11-22T14:05:00Z', domain: 'example.com', type: 'DDOS', status: 'active', mitigation_summary: { active_mitigations: 0 } }] },
      abuseReports_get: { id: 'AB-94821', cdate: '2026-11-22T14:05:00Z', domain: 'example.com', type: 'DDOS', status: 'active', justification: 'Sustained request flood against login.example.com', source_ips: ['203.0.113.54'], urls: ['https://login.example.com/'] },
      abuseReports_mitigations_list: { mitigations: [] },
      firewall_accessRules_list: []
    },
    steps: [
      step('find the report and its address', true, 'abuseReports_list', 'abuseReports_get'),
      ZONE,
      step('block the address on the zone', true, 'firewall_accessRules_create', 'rulesets_rules_create', 'rulesets_update')
    ]
  },
  {
    id: 'tag-trigger',
    world: {
      ...zone('example.com', '2d7f1a9c4e6b4f0a8c5d3e1b9a7f6c20'),
      zaraz_workflow_get: 'preview',
      zaraz_config_get: { zarazVersion: 43, debugKey: 'my-debug-key', dataLayer: true, tools: {}, variables: {}, settings: { autoInjectScript: true }, triggers: { pageview: { name: 'Pageview', description: 'All page views', loadRules: [{ match: '{{ client.__zarazTrack }}', op: 'EQUALS', value: 'Pageview' }], excludeRules: [], system: 'pageload' } } },
      zaraz_default_get: { zarazVersion: 43, tools: {}, triggers: {}, variables: {}, settings: {} },
      zaraz_history_list: [{ id: 43, createdAt: '2026-10-30T09:00:00Z', description: 'Add pageview trigger' }]
    },
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
    world: {
      ...script('search-service', [{ type: 'ai', name: 'AI' }]),
      vectorize_list: [],
      vectorize_create: { name: 'catalog-embeddings', config: { dimensions: 768, metric: 'cosine' }, created_on: '2026-11-24T10:00:00Z' },
      vectorize_insert: { mutationId: '0000aeb4-b6f2-4a3c-9d1e-7f5b3c1a9e02' },
      vectorize_upsert: { mutationId: '0000aeb4-b6f2-4a3c-9d1e-7f5b3c1a9e02' }
    },
    steps: [
      step('create the index', true, 'vectorize_create'),
      optional("read the script's bindings", false, ...SCRIPT_SETTINGS_GET),
      step('add the binding', true, ...SCRIPT_SETTINGS_EDIT),
      step('insert the vector', true, 'vectorize_insert', 'vectorize_upsert')
    ]
  }
]

type Written = { writer: string; product: string; kind: 'single' | 'cross'; task: string; products?: string[]; steps: { does: string; stated: boolean; product?: string }[] }
const written = JSON.parse(readFileSync(new URL('../results/tasks/workflow/tasks.json', import.meta.url), 'utf8')) as Written[]
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
  for (const entry of [...need.steps.flatMap((s) => s.tools), ...Object.keys(need.world)]) if (!names.some((name) => name.startsWith(entry))) throw new Error(`${need.id}: no tool starts with ${entry}`)
  const required = need.steps.filter((s) => !s.optional)
  if (required.length < 3) throw new Error(`${need.id}: fewer than three required steps`)
  // The products of the required steps, from the tool names. A `single` task can still span several.
  const prefixes = [...new Set(required.flatMap((s) => s.tools.map(prefixOf)))]
  out.push({ id: need.id, product: task.product, kind: task.kind, writer: task.writer, task: task.task, prefixes, steps: need.steps, world: need.world, writerSteps: task.steps })
  console.error(`${need.id} | ${task.kind} | ${required.length} required, ${required.filter((s) => !s.stated).length} unsaid | ${prefixes.join(' ')}`)
}
writeFileSync(new URL('../tasks/workflow-tasks.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
console.error(`${out.length} tasks in tasks/workflow-tasks.json`)
