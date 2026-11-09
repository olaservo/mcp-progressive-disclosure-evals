import generated from './group-descriptions.generated.json'

/**
 * Task-vocabulary descriptions for the recommended server's product groups. The subset's are written by hand
 * from the jobs a user would bring. The full catalog's come from scripts/describe-groups.ts, which has a model
 * write each one from the group's tool descriptions; the ones the first run's misses landed on were reviewed by hand.
 */
export const HAND_DESCRIPTIONS: Record<string, string> = {
  'turnstile-api': 'Turnstile widgets: list, read, create, update or delete the bot-check widgets in an account, and rotate a widget secret.',
  'durable-objects-api': 'Deployed Durable Objects: list the namespaces (one per Durable Object class) in an account and the objects in each that hold stored data.',
  'email-sending-api': 'Outbound email from Workers: send a message, onboard and verify a sending subdomain and its DNS records, suppression lists, sending limits and reputation.',
  'email-routing-api': 'Inbound email forwarding for a zone: enable or disable Email Routing, forwarding rules and the catch-all rule, verified destination addresses, and the MX and SPF records it needs.',
  'workers-core': 'Workers as account resources: create, list, update or delete a Worker; Cron Triggers that run a Worker on a schedule; account-level Workers settings; the workers.dev subdomain; asset upload sessions; live log tails; placement regions.',
  'workers-versions': 'Worker versions: upload new code as a version, list and inspect versions, and edit the latest one. A version goes live through a deployment.',
  'workers-deployments': 'Worker deployments: put one or more uploaded versions live with a traffic split, roll back, and list or delete past deployments.',
  'workers-legacy': 'Worker scripts through the original script API: upload a script and its bundle in one step, read or replace its content, settings, usage model and per-script workers.dev route.',
  'workers-previews': 'Preview deployments of a Worker: create, list and edit previews and the deployments behind each.',
  'workers-routes': 'Zone routes: map URL patterns on a zone to a Worker.',
  'workers-domains': 'Custom domains attached directly to a Worker.',
  'workers-secrets': 'Encrypted secrets and environment variables bound to a Worker script: set, list, read, bulk update or delete.',
  'd1-api': 'D1 serverless SQL databases (SQLite): create, list, update or delete a database, run SQL queries against it, and restore it to a point in time with Time Travel.',
  'kv-api': 'Workers KV, a global eventually consistent key-value store: create and manage namespaces, read, write, list (by key prefix) and delete keys singly or in bulk, and key metadata.',
  'r2-buckets': 'R2 object storage buckets: create and configure buckets, CORS rules for browser access from other origins, lifecycle rules that expire or transition objects, custom and r2.dev domains, event notifications, object locks, Sippy incremental migration, metrics, and temporary access credentials.',
  'r2-objects': 'Objects in an R2 bucket: upload, download, list and delete objects.',
  'r2-super-slurper': 'Super Slurper: bulk migration jobs that copy data from S3 or another provider into R2, with connectivity checks, progress and logs.',
  'queues-api': 'Cloudflare Queues for background and asynchronous jobs: create queues, add consumers with retry and dead-letter settings, push, pull and acknowledge messages, purge a queue, event subscriptions, and metrics.',
  'containers-api': 'Cloudflare Containers: run a container image as an application at the edge, roll out new versions, list running instances, prepare images and manage image registry credentials.'
}

export const GENERATED_DESCRIPTIONS: Record<string, string> = generated

export const describeGroup = (name: string): string | undefined => HAND_DESCRIPTIONS[name] ?? GENERATED_DESCRIPTIONS[name]
