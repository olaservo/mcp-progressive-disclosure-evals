// The 20 tasks of the second selection set, as prompts for a real agent session, with a completion rubric each.
// `firstPick` is the selection rule from select.ts: a group name, a skill name, or a tool-name prefix the agent's
// first step may hit. `done` reads the calls the session made and the final answer.

export type Call = { name: string; args: Record<string, unknown>; isError: boolean }
/** `groupLoadsSkill`: the session ran under the round-one mod, whose open_group inlined the group's SKILL.md. */
export type Picks = { groups: string[]; skills: string[]; tools: Call[]; groupLoadsSkill?: boolean }
export type TraceTask = {
  id: string
  task: string
  /** Group names, skill names (as `skill:<name>`) or tool-name prefixes that count as the right first step. */
  firstPick: string[]
  done: (picks: Picks, answer: string) => boolean
  /** The task has no fitting tool on the subset; completion is saying so without calling an unrelated tool. */
  noTool?: boolean
}

export const PREAMBLE = [
  'You are connected to a Cloudflare API MCP server whose tools are dry runs: each returns the HTTP request it would send and changes nothing.',
  'Use these identifiers: account id `demo`, zone id `demo-zone`, and for anything else a plausible placeholder prefixed `demo-` (for example `demo-sitekey`, `demo-bucket`).',
  'Do the task with the tools available instead of describing how you would. Do not ask questions. If no tool fits, say so and stop.',
  'Finish with two sentences on what you did.'
].join(' ')

const DO_CLASS = `
\`\`\`ts
export class Room extends DurableObject {
  async fetch(request: Request) {
    const count = (await this.ctx.storage.get<number>("count")) ?? 0;
    await this.ctx.storage.put("count", count + 1);
    setTimeout(() => this.flush(), 60 * 60 * 1000);
    return new Response(String(count + 1));
  }
  async alarm() {
    await this.flush();
  }
  async flush() {
    const pending = await this.ctx.storage.get<string[]>("pending");
    await fetch("https://example.com/sink", { method: "POST", body: JSON.stringify(pending) });
  }
}
\`\`\``

const called = (picks: Picks, re: RegExp) => picks.tools.some((c) => re.test(c.name) && !c.isError)
const argsText = (picks: Picks, re: RegExp) => picks.tools.filter((c) => re.test(c.name)).map((c) => JSON.stringify(c.args)).join('\n')
const loaded = (picks: Picks, skill: string) => picks.skills.includes(skill) || (!!picks.groupLoadsSkill && picks.groups.includes(skill))

export const TRACE_TASKS: TraceTask[] = [
  {
    id: 'bot-check',
    task: 'Add a bot check to our signup form at demo.example and verify the challenge result on the server before accepting the submission.',
    firstPick: ['turnstile-spin', 'turnstile-api', 'turnstile-widgets', 'skill:turnstile-spin', 'turnstile_'],
    done: (p, a) => called(p, /^turnstile_widgets_create$/) && /siteverify|verify/i.test(a)
  },
  {
    id: 'rotate-secret',
    task: "The server-side secret that validates our signup form's bot challenge was committed to a public repo. Rotate it. The widget's sitekey is demo-sitekey.",
    firstPick: ['turnstile-spin', 'turnstile-api', 'turnstile-widgets', 'skill:turnstile-spin', 'turnstile_'],
    done: (p) => called(p, /^turnstile_widgets_rotateSecret$/) && /demo-sitekey/.test(argsText(p, /rotateSecret/))
  },
  {
    id: 'forward-billing',
    task: 'Forward everything sent to billing@demo.example to billing-inbox@gmail.com.',
    firstPick: ['cloudflare-email-service', 'email-routing-api', 'email-routing-rules', 'skill:cloudflare-email-service', 'emailRouting_'],
    done: (p) => called(p, /^emailRouting_rules_create$/) && /billing/.test(argsText(p, /emailRouting_rules_create/))
  },
  {
    id: 'sender-address',
    task: 'Set up a sender address so our edge function can email order receipts after checkout, from the subdomain mail.demo.example.',
    firstPick: ['cloudflare-email-service', 'email-sending-api', 'email-sending-subdomains', 'skill:cloudflare-email-service', 'emailSending_'],
    done: (p) => called(p, /^emailSending_subdomains_create$/)
  },
  {
    id: 'mail-dns',
    task: 'Check whether the DNS records for our outbound mail subdomain mail.demo.example have verified, and fix them if not.',
    firstPick: ['cloudflare-email-service', 'email-sending-api', 'email-sending-subdomains', 'skill:cloudflare-email-service', 'emailSending_'],
    done: (p) => called(p, /^emailSending_subdomains_(dns|get|list|verify)/)
  },
  {
    id: 'state-holder',
    task: 'Write a per-chat-room state holder for our Worker that serializes writes and wakes itself once an hour. Give me the class.',
    firstPick: ['durable-objects', 'durable-objects-api', 'skill:durable-objects'],
    done: (p, a) => loaded(p, 'durable-objects') && /alarm/i.test(a) && /class/i.test(a)
  },
  {
    id: 'instances-with-data',
    task: 'Which of our stateful object classes have instances that currently hold stored data?',
    firstPick: ['durable-objects', 'durable-objects-api', 'durable-objects-namespaces', 'skill:durable-objects', 'durableObjects_'],
    // The second step needs namespace ids the dry-run server never returns, so the first read is the rubric.
    done: (p) => called(p, /^durableObjects_namespaces_list$/)
  },
  {
    id: 'review-alarms',
    task: `Review our stateful coordination class for alarm-handling bugs and tell me what to change.${DO_CLASS}`,
    firstPick: ['durable-objects', 'durable-objects-api', 'skill:durable-objects'],
    done: (p, a) => loaded(p, 'durable-objects') && /setAlarm|setTimeout/i.test(a)
  },
  {
    id: 'image-jobs',
    task: 'Process image-resize jobs in the background, retrying any job that fails. Create what is needed and name it demo-image-jobs.',
    firstPick: ['queues-api', 'queues_'],
    done: (p) => called(p, /^queues_create$/)
  },
  {
    id: 'dead-letter',
    task: 'Add a dead-letter destination named demo-orders-dlq for messages that fail repeatedly on the orders queue, whose id is demo-orders-queue.',
    firstPick: ['queues-api', 'queues-consumers', 'queues_'],
    done: (p) => called(p, /^queues_(consumers_(create|update)|edit)$/) && /dead_letter|dlq/i.test(argsText(p, /^queues_/))
  },
  {
    id: 'cors-uploads',
    task: 'Serve 50 GB of user uploads from the bucket demo-uploads to browsers on https://app.demo.example, so cross-origin headers are needed.',
    firstPick: ['r2-api', 'r2-buckets', 'r2_'],
    done: (p) => called(p, /^r2_buckets_cors_(update|put)$/) && /app\.demo\.example/.test(argsText(p, /cors/))
  },
  {
    id: 'expire-tmp',
    task: 'Expire files under tmp/ in the bucket demo-uploads after 7 days.',
    firstPick: ['r2-api', 'r2-buckets', 'r2_'],
    done: (p) => called(p, /^r2_buckets_lifecycle_(update|put)$/) && /tmp\//.test(argsText(p, /lifecycle/))
  },
  {
    id: 'feature-flags',
    task: 'Store small read-heavy feature flags at the edge for our Worker. Eventual consistency is fine. Create the store and write a flag new_checkout=true.',
    firstPick: ['kv-api', 'kv-namespaces', 'kv_'],
    done: (p) => called(p, /^kv_namespaces_create$/) && called(p, /^kv_(keys_put|bulk_put)$/)
  },
  {
    id: 'purge-sessions',
    task: 'Remove every entry whose key begins with "session:" from the edge key-value store whose namespace id is demo-kv.',
    firstPick: ['kv-api', 'kv-keys', 'kv-bulk', 'kv_'],
    // Deleting needs the key names the dry-run list never returns, so a prefix-scoped list is the rubric.
    done: (p) => called(p, /^kv_keys_list$/) && /session:/.test(argsText(p, /^kv_keys_list$/))
  },
  {
    id: 'relational',
    task: 'We need relational tables with SQL joins for orders, serverless, with no connection pooling to manage. Create the database demo-orders and a table orders(id, customer_id, total).',
    firstPick: ['d1-api', 'd1_'],
    done: (p) => called(p, /^d1_create$/) && called(p, /^d1_query$/)
  },
  {
    id: 'push-build',
    task: 'Push the new build of our edge function demo-api (the bundle is at dist/index.js) and make it live.',
    firstPick: ['workers-api', 'workers-scripts', 'workers-versions', 'workers-deployments', 'workers-legacy', 'skill:wrangler', 'workers_'],
    // The bundle is a file the session cannot read, so a model that names the upload step and says it cannot read
    // dist/index.js counts, as does a dry-run upload with placeholder content.
    done: (p, a) =>
      called(p, /^workers_(legacy_scripts_(update|content_update|versions_create)|versions_create|deployments_create)$/) ||
      (loaded(p, 'wrangler') && /wrangler deploy/i.test(a)) ||
      (/dist\/index\.js/.test(a) && /read|load|access/i.test(a) && /workers_versions_create|new version|deploy/i.test(a))
  },
  {
    id: 'nightly',
    task: 'Run our edge function demo-api every night at 02:00 UTC.',
    firstPick: ['workers-api', 'workers-scripts', 'workers-core', 'skill:wrangler', 'workers_'],
    done: (p, a) => (called(p, /^workers_scripts_schedules_update$/) && /0 2 \* \* \*/.test(argsText(p, /schedules/))) || (loaded(p, 'wrangler') && /0 2 \* \* \*/.test(a))
  },
  {
    id: 'docker-edge',
    task: 'Run our Docker image registry.demo.example/api:1.2 at the edge as demo-api-app and show the running instances.',
    firstPick: ['containers-api', 'containers-applications', 'containers_'],
    done: (p) => called(p, /^containers_applications_create$/) && called(p, /^containers_applications_instances_list$/)
  },
  {
    id: 'fetch-handler',
    task: "What is the recommended structure for an edge function's fetch handler?",
    firstPick: ['skill:workers-best-practices', 'none'],
    done: (p, a) => loaded(p, 'workers-best-practices') && /fetch/i.test(a) && p.tools.length === 0
  },
  {
    id: 'rotate-token',
    task: 'Rotate the account API token our deployment pipeline uses.',
    firstPick: ['none'],
    noTool: true,
    done: (p, a) => p.tools.length === 0 && /no tool|none of|no (\w+ )*(tool|group|endpoint)|cannot|can't|could ?n.t|unable|not (available|possible|exposed)|did ?n.t|does ?n.t|is ?n.t/i.test(a)
  }
]
