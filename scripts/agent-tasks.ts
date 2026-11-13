// Five scenarios of six phases each for agent-run.ts and agent-ref.ts. A phase is one user turn that needs one or two tools
// from one group of the opt2-rec subset server, and phase five returns to a group an earlier phase used. The phases name
// no group and no tool. `done` reads the calls a phase made that the server did not reject.
// Written on 2026-11-12 by Fable 5.2, which the demo does not test, with the subset's group listing and schemas in view.

export type AgentCall = { name: string; args: Record<string, unknown>; isError: boolean }
export type Phase = {
  task: string
  /** Groups whose tools do the phase. */
  groups: string[]
  done: (calls: AgentCall[]) => boolean
}
export type Scenario = { id: string; phases: Phase[] }

type Need = RegExp | ((args: Record<string, unknown>) => boolean)
/**
 * A body passed as a JSON string reads the same as one passed as an object. The version committed before the runs only
 * unescaped the quotes, so a string body with spaces after its colons did not match; `asCommitted` scores that way.
 */
export const rubricOptions = { asCommitted: false }
const unstring = (value: unknown): unknown => {
  if (typeof value === 'string' && /^\s*[[{]/.test(value)) { try { return unstring(JSON.parse(value)) } catch { return value } }
  if (Array.isArray(value)) return value.map(unstring)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, unstring(v)]))
  return value
}
const text = (args: unknown) => (rubricOptions.asCommitted ? JSON.stringify(args).replace(/\\+"/g, '"') : JSON.stringify(unstring(args)))
const meets = (call: AgentCall, name: RegExp, needs: Need[]) => !call.isError && name.test(call.name) && needs.every((need) => (need instanceof RegExp ? need.test(text(call.args)) : need(call.args)))
/** Some call to a tool matching `name` whose arguments meet every need. */
const has = (calls: AgentCall[], name: RegExp, ...needs: Need[]) => calls.some((call) => meets(call, name, needs))
const num = (key: string, value: number) => new RegExp(`"${key}":"?${value}"?[,}\\]]`)
const body = (args: Record<string, unknown>): Record<string, unknown> => {
  const raw = args.body
  if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} } }
  return (raw ?? {}) as Record<string, unknown>
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'uploads',
    phases: [
      {
        task: 'Create a storage bucket named demo-uploads with a Western Europe location hint. Then let browsers on https://app.demo.example read from it and upload to it with GET and PUT.',
        groups: ['r2-buckets'],
        done: (c) =>
          has(c, /^r2_buckets_create$/, /"name":"demo-uploads"/, /"locationHint":"weur"/) &&
          has(c, /^r2_buckets_cors_update$/, /"bucket_name":"demo-uploads"/, /app\.demo\.example/, /"GET"/, /"PUT"/)
      },
      {
        task: 'Create a queue named demo-upload-events; treat its id as demo-upload-events-id. Attach our Worker demo-thumbnailer as its consumer with at most 5 retries, and send messages that still fail to the queue demo-upload-dlq.',
        groups: ['queues-api'],
        done: (c) =>
          has(c, /^queues_create$/, /"queue_name":"demo-upload-events"/) &&
          has(c, /^queues_consumers_(create|update)$/, /"queue_id":"demo-upload-events-id"/, /"script_name":"demo-thumbnailer"/, num('max_retries', 5), /"dead_letter_queue":"demo-upload-dlq"/)
      },
      {
        task: 'Create a key-value namespace titled demo-thumb-cache; treat its id as demo-thumb-cache-id. Store the key config:max_width in it with the value 1280, expiring after one day.',
        groups: ['kv-api'],
        done: (c) =>
          has(c, /^kv_namespaces_create$/, /"title":"demo-thumb-cache"/) &&
          has(c, /^kv_(keys|bulk)_put$/, /"namespace_id":"demo-thumb-cache-id"/, /config:max_width/, /1280/, /"expiration_ttl":"?86400"?[,}\]]|"expiration":"?\d{10}"?[,}\]]/)
      },
      {
        task: 'Give the Worker demo-thumbnailer an encrypted secret named SIGNING_KEY with the value demo-signing-key.',
        groups: ['workers-secrets'],
        done: (c) => has(c, /^workers_secrets_(update|bulk)$/, /"script_name":"demo-thumbnailer"/, /SIGNING_KEY/, /demo-signing-key/)
      },
      {
        task: 'Back on the demo-uploads bucket: delete objects under tmp/ once they are 7 days old, and notify the demo-upload-events queue whenever an object is created under incoming/.',
        groups: ['r2-buckets'],
        done: (c) =>
          has(c, /^r2_buckets_lifecycle_update$/, /"bucket_name":"demo-uploads"/, /"prefix":"tmp\/"/, num('maxAge', 604800)) &&
          has(c, /^r2_buckets_eventNotifications_update$/, /"bucket_name":"demo-uploads"/, /"queue_id":"demo-upload-events-id"/, /"prefix":"incoming\/"/, /PutObject/)
      },
      {
        task: 'Run demo-thumbnailer on a schedule, every night at 03:30 UTC.',
        groups: ['workers-core'],
        done: (c) => has(c, /^workers_scripts_schedules_update$/, /"script_name":"demo-thumbnailer"/, /"cron":"30 3 \* \* \*"/)
      }
    ]
  },
  {
    id: 'shop-api',
    phases: [
      {
        task: 'Create a serverless SQL database named demo-orders with an Eastern Europe primary location hint; treat its id as demo-orders-id. Then create a table orders with the columns id, customer_id and total.',
        groups: ['d1-api'],
        done: (c) =>
          has(c, /^d1_create$/, /"name":"demo-orders"/, /"primary_location_hint":"eeur"/) &&
          has(c, /^d1_(query|raw)$/, /"database_id":"demo-orders-id"/, /create\s+table/i, /orders/, /customer_id/, /total/)
      },
      {
        task: 'Send requests for api.demo.example/* on the zone demo-zone to our Worker demo-api.',
        groups: ['workers-routes'],
        done: (c) => has(c, /^workers_routes_create$/, /"zone_id":"demo-zone"/, /"pattern":"api\.demo\.example\/\*"/, /"script":"demo-api"/)
      },
      {
        task: 'Also attach the hostname shop.demo.example directly to demo-api as its own domain, enabled, with previews off. The zone is demo.example and its id is demo-zone.',
        groups: ['workers-domains'],
        done: (c) =>
          has(c, /^workers_domains_update$/, /"hostname":"shop\.demo\.example"/, /"service":"demo-api"/, /"zone_id":"demo-zone"/, /"zone_name":"demo\.example"/, /"enabled":true/, /"previews_enabled":false/)
      },
      {
        task: 'Create a bot-check widget named demo-checkout for shop.demo.example in managed mode; treat its sitekey as demo-checkout-sitekey. Then rotate its secret so that the old one stops working immediately.',
        groups: ['turnstile-api', 'turnstile-spin'],
        done: (c) =>
          has(c, /^turnstile_widgets_create$/, /"name":"demo-checkout"/, /shop\.demo\.example/, /"mode":"managed"/) &&
          has(c, /^turnstile_widgets_rotateSecret$/, /"sitekey":"demo-checkout-sitekey"/, /"invalidate_immediately":true/)
      },
      {
        task: 'Back in the demo-orders database: add an index on orders.customer_id, then count the orders of customer 42, passing 42 as a bound parameter and not inside the SQL text.',
        groups: ['d1-api'],
        done: (c) =>
          has(c, /^d1_(query|raw)$/, /"database_id":"demo-orders-id"/, /create\s+(unique\s+)?index/i, /customer_id/) &&
          has(c, /^d1_(query|raw)$/, /"database_id":"demo-orders-id"/, /count\s*\(/i, /customer_id\s*=\s*\?/, /"params":\["?42"?\]/)
      },
      {
        task: 'Version demo-api-v2 of demo-api is already uploaded. Put it live for 10 percent of traffic, with the current version demo-api-v1 keeping the other 90.',
        groups: ['workers-deployments'],
        done: (c) =>
          has(c, /^workers_deployments_create$/, /"script_name":"demo-api"/, /"strategy":"percentage"/, (args) => {
            const versions = (body(args).versions ?? []) as { percentage?: unknown; version_id?: unknown }[]
            const share = (id: string) => Number(versions.find((v) => v.version_id === id)?.percentage)
            return Array.isArray(versions) && versions.length === 2 && share('demo-api-v2') === 10 && share('demo-api-v1') === 90
          })
      }
    ]
  },
  {
    id: 'resizer',
    phases: [
      {
        task: 'Run the container image registry.demo.example/resizer:2.1 as an application named demo-resizer on the basic instance type, with 2 instances and at most 4. Treat its id as demo-resizer-id and list its instances.',
        groups: ['containers-api'],
        done: (c) =>
          has(c, /^containers_applications_create$/, /"image":"registry\.demo\.example\/resizer:2\.1"/, /"name":"demo-resizer"/, /[{,]"instances":"?2"?[,}]/, num('max_instances', 4), /"instance_type":"basic"/) &&
          has(c, /^containers_applications_instances_list$/, /"application_id":"demo-resizer-id"/)
      },
      {
        task: 'Serve the storage bucket demo-resized on the hostname img.demo.example, enabled, with a minimum TLS version of 1.2. The zone id is demo-zone.',
        groups: ['r2-buckets'],
        done: (c) => has(c, /^r2_buckets_domains_custom_create$/, /"bucket_name":"demo-resized"/, /"domain":"img\.demo\.example"/, /"zoneId":"demo-zone"/, /"enabled":true/, /"minTLS":"1\.2"/)
      },
      {
        task: 'In the key-value namespace with id demo-kv, write these three entries in a single request: size:small = 320, size:medium = 640, size:large = 1280.',
        groups: ['kv-api'],
        done: (c) => has(c, /^kv_bulk_put$/, /"namespace_id":"demo-kv"/, /"key":"size:small"/, /"key":"size:medium"/, /"key":"size:large"/, /"value":"?320"?/, /"value":"?640"?/, /"value":"?1280"?/)
      },
      {
        task: 'Create a queue named demo-resize-jobs; treat its id as demo-resize-jobs-id. Push one JSON message to it: {"image":"a.png","width":640}.',
        groups: ['queues-api'],
        done: (c) =>
          has(c, /^queues_create$/, /"queue_name":"demo-resize-jobs"/) &&
          has(c, /^queues_messages_(push|bulkPush)$/, /"queue_id":"demo-resize-jobs-id"/, /a\.png/, /640/)
      },
      {
        task: 'Roll demo-resizer out to the image registry.demo.example/resizer:2.2 with a rolling strategy in steps of 25 percent. Describe the rollout as "resizer 2.2".',
        groups: ['containers-api'],
        done: (c) =>
          has(c, /^containers_applications_rollouts_create$/, /"application_id":"demo-resizer-id"/, /"strategy":"rolling"/, num('step_percentage', 25), /"image":"registry\.demo\.example\/resizer:2\.2"/, /"description":"resizer 2\.2"/)
      },
      {
        task: 'List the namespaces of our stateful object classes, then list the objects that hold stored data in the namespace with id demo-rooms-ns.',
        groups: ['durable-objects-api', 'durable-objects'],
        done: (c) => has(c, /^durableObjects_namespaces_list$/) && has(c, /^durableObjects_namespaces_objects_list$/, /"id":"demo-rooms-ns"/)
      }
    ]
  },
  {
    id: 'mail',
    phases: [
      {
        task: 'Register ops-inbox@gmail.com as a destination we can forward mail to. Then forward everything sent to support@demo.example on the zone demo-zone to it.',
        groups: ['email-routing-api', 'cloudflare-email-service'],
        done: (c) =>
          has(c, /^emailRouting_addresses_create$/, /"email":"ops-inbox@gmail\.com"/) &&
          has(c, /^emailRouting_rules_create$/, /"zone_id":"demo-zone"/, /support@demo\.example/, /"type":"forward"/, /ops-inbox@gmail\.com/)
      },
      {
        task: 'Set up mail.demo.example on the zone demo-zone as a subdomain our Worker can send mail from; treat its id as demo-mail-sub. Then check the status of its DNS records.',
        groups: ['email-sending-api', 'cloudflare-email-service'],
        done: (c) =>
          has(c, /^emailSending_subdomains_create$/, /"zone_id":"demo-zone"/, /"name":"mail\.demo\.example"/) &&
          has(c, /^emailSending_subdomains_dns_(status|get)$/, /"subdomain_id":"demo-mail-sub"/)
      },
      {
        task: 'Store two secrets on the Worker demo-mailer in a single request: MAIL_FROM = receipts@mail.demo.example and REPLY_TO = support@demo.example.',
        groups: ['workers-secrets'],
        done: (c) => has(c, /^workers_secrets_bulk$/, /"script_name":"demo-mailer"/, /MAIL_FROM/, /receipts@mail\.demo\.example/, /REPLY_TO/, /support@demo\.example/)
      },
      {
        task: 'Upload a text object named welcome.txt with the content hello to the storage bucket demo-mail-assets, then list the objects in that bucket under the prefix templates/.',
        groups: ['r2-objects'],
        done: (c) =>
          has(c, /^r2_objects_put$/, /"bucket_name":"demo-mail-assets"/, /"object_key":"welcome\.txt"/, /hello/) &&
          has(c, /^r2_objects_list$/, /"bucket_name":"demo-mail-assets"/, /"prefix":"templates\/"/)
      },
      {
        task: 'Back to inbound mail on demo-zone: make the catch-all drop every message that no rule matches, and make sure the catch-all is enabled.',
        groups: ['email-routing-api', 'cloudflare-email-service'],
        done: (c) => has(c, /^emailRouting_rules_catchAll_update$/, /"zone_id":"demo-zone"/, /"type":"drop"/, /"enabled":true/)
      },
      {
        task: 'Run demo-mailer on two schedules: every weekday at 09:00 UTC, and at minute 0 of every hour.',
        groups: ['workers-core'],
        done: (c) => has(c, /^workers_scripts_schedules_update$/, /"script_name":"demo-mailer"/, /"cron":"0 9 \* \* (1-5|mon-fri)"/i, /"cron":"0 \* \* \* \*"/)
      }
    ]
  },
  {
    id: 'migration',
    phases: [
      {
        task: 'Create a storage bucket named demo-archive in the EU jurisdiction with the Infrequent Access storage class. Then lock every object in it against deletion for 30 days.',
        groups: ['r2-buckets'],
        done: (c) =>
          has(c, /^r2_buckets_create$/, /"name":"demo-archive"/, /"storageClass":"InfrequentAccess"/, /"cf-r2-jurisdiction":"eu"/) &&
          has(c, /^r2_buckets_locks_update$/, /"bucket_name":"demo-archive"/, /"cf-r2-jurisdiction":"eu"/, /"type":"Age"/, num('maxAgeSeconds', 2592000))
      },
      {
        task: 'We are moving the S3 bucket legacy-archive in us-east-1 into demo-archive. Check that the source is reachable with access key id demo-key and secret demo-secret, then start the migration job. The target credentials are access key id demo-r2-key and secret demo-r2-secret.',
        groups: ['r2-super-slurper'],
        done: (c) =>
          has(c, /^r2_superSlurper_connectivityPrecheck_source$/, /"bucket":"legacy-archive"/, /"vendor":"s3"/, /"region":"us-east-1"/, /"accessKeyId":"demo-key"/) &&
          has(c, /^r2_superSlurper_jobs_create$/, (args) => {
            const { source, target } = body(args) as { source?: Record<string, unknown>; target?: Record<string, unknown> }
            return source?.bucket === 'legacy-archive' && source.vendor === 's3' && target?.bucket === 'demo-archive' && target.vendor === 'r2' && target.jurisdiction === 'eu' && /demo-r2-key/.test(text(target))
          })
      },
      {
        task: 'For the SQL database with id demo-orders-id, get the restore bookmark for 2026-11-01T00:00:00Z, then restore the database to that point in time.',
        groups: ['d1-api'],
        done: (c) =>
          has(c, /^d1_timeTravel_getBookmark$/, /"database_id":"demo-orders-id"/, /"timestamp":"2026-11-01T00:00:00(\.000)?Z"/) &&
          has(c, /^d1_timeTravel_restore$/, /"database_id":"demo-orders-id"/, /"timestamp":"2026-11-01T00:00:00(\.000)?Z"|"bookmark":"[^"]+"/)
      },
      {
        task: 'In the key-value namespace with id demo-kv, list the keys that begin with legacy: and then delete the keys legacy:a and legacy:b in a single request.',
        groups: ['kv-api'],
        done: (c) =>
          has(c, /^kv_keys_list$/, /"namespace_id":"demo-kv"/, /"prefix":"legacy:"/) &&
          has(c, /^kv_bulk_delete$/, /"namespace_id":"demo-kv"/, /"legacy:a"/, /"legacy:b"/)
      },
      {
        task: 'Back to the bucket migration: show the progress of the job with id demo-job-1, then pause it.',
        groups: ['r2-super-slurper'],
        done: (c) => has(c, /^r2_superSlurper_jobs_progress$/, /"job_id":"demo-job-1"/) && has(c, /^r2_superSlurper_jobs_pause$/, /"job_id":"demo-job-1"/)
      },
      {
        task: 'Turn on observability for the Worker demo-archiver: logs enabled, invocation logs included, sampling 10 percent of requests.',
        groups: ['workers-legacy', 'workers-core'],
        done: (c) =>
          has(c, /^workers_(legacy_scripts_settings_edit|legacy_scripts_scriptAndVersionSettings_edit|edit|update)$/, /demo-archiver/, (args) => {
            const observability = (body(args).observability ?? (body(args).settings as Record<string, unknown> | undefined)?.observability) as { enabled?: unknown; head_sampling_rate?: unknown; logs?: { enabled?: unknown; invocation_logs?: unknown; head_sampling_rate?: unknown } } | undefined
            return observability?.enabled === true && observability.logs?.enabled === true && observability.logs.invocation_logs === true && (observability.head_sampling_rate === 0.1 || observability.logs.head_sampling_rate === 0.1)
          })
      }
    ]
  }
]
