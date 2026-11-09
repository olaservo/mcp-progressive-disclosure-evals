// Runs the same task against every variant and prints what a client has to fetch and what the model sees.
// Usage: tsx scripts/compare.ts [base URL, default http://localhost:8787] [--urls flat=https://...,opt2=https://...]
import * as z from 'zod/v4'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { SkillsClient } from '@modelcontextprotocol/client/ext/skills'
import { getEncoding } from 'js-tiktoken'

const VARIANTS = ['flat', 'opt1', 'opt2', 'opt3'] as const
type Variant = (typeof VARIANTS)[number]
const GROUPS = 'io.modelcontextprotocol/groups'
const SKILLS = 'io.modelcontextprotocol/skills'
/** Each task is one cloudflare/skills workflow. `prefixes` pick its tools out of a flat tools/list. */
const TASKS = [
  { skill: 'turnstile-spin', label: 'set up Turnstile', prefixes: ['turnstile_'] },
  { skill: 'durable-objects', label: 'inspect Durable Objects', prefixes: ['durableObjects_'] },
  { skill: 'cloudflare-email-service', label: 'configure email', prefixes: ['emailSending_', 'emailRouting_'] }
] as const
type Task = (typeof TASKS)[number]

const args = process.argv.slice(2)
const base = args.find((arg) => !arg.startsWith('--') && !arg.includes('=')) ?? 'http://localhost:8787'
const urlsArg = args.includes('--urls') ? args[args.indexOf('--urls') + 1] : undefined
const overrides: Record<string, string> = Object.fromEntries((urlsArg ? urlsArg.split(',') : []).map((pair) => pair.split('=') as [string, string]))
const urlFor = (variant: Variant) => overrides[variant] ?? `${base}/${variant}/mcp`

const Loose = z.looseObject({})
const size = (value: unknown) => JSON.stringify(value).length
// tiktoken o200k_base over the compact JSON the model would see, the same measure as the data point the SEP cites.
const encoding = getEncoding('o200k_base')
const count = (value: unknown) => encoding.encode(typeof value === 'string' ? value : JSON.stringify(value)).length

async function connect(variant: Variant, modern: boolean): Promise<Client> {
  const client = new Client(
    { name: 'groups-compare', version: '0.2.0' },
    // The modern client speaks 2026-07-28, where capabilities ride on every request. The other is a 2025-era client.
    modern ? { capabilities: { extensions: { [GROUPS]: {}, [SKILLS]: {} } }, versionNegotiation: { mode: 'auto' } } : { capabilities: { extensions: { [SKILLS]: {} } } }
  )
  await client.connect(new StreamableHTTPClientTransport(new URL(urlFor(variant))))
  return client
}

interface Row {
  variant: Variant
  task: Task
  wire: number
  upfront: number
  taskLoad: number
  taskTools: number
  legacyTools: number
  notes: string[]
}

type Named = { name: string; description?: string }
type Schema = { type?: string; properties?: Record<string, Schema>; required?: string[] }
type Tool = Named & { inputSchema?: Schema }
type Body = { instructions?: string; tools?: Tool[]; resources?: { uri: string }[] }

/** Placeholder arguments that satisfy a forge tool's required path and body parameters. */
function argsFor(tool: Tool): Record<string, unknown> {
  const fill = (schema: Schema | undefined): unknown => {
    if (schema?.type === 'object' || schema?.properties) return Object.fromEntries((schema?.required ?? []).map((key) => [key, fill(schema?.properties?.[key])]))
    return 'demo'
  }
  return fill(tool.inputSchema) as Record<string, unknown>
}

async function run(variant: Variant, task: Task): Promise<Row> {
  const notes: string[] = []
  const isTaskTool = (name: string) => task.prefixes.some((prefix) => name.startsWith(prefix))
  const client = await connect(variant, true)
  const caps = client.getServerCapabilities() ?? {}
  // Option 3 serves renamed groups under the Skills extension's identifier.
  const noun = variant === 'opt3' ? 'skills' : caps.extensions?.[GROUPS] !== undefined ? 'groups' : undefined
  const sep2640 = caps.extensions?.[SKILLS] !== undefined && variant !== 'opt3' ? new SkillsClient(client) : undefined
  let wire = 0
  let upfront = 0
  let taskLoad = 0
  let taskTools = 0

  // What the model can choose from before it commits to the task.
  const tools: Named[] = (await client.listTools()).tools
  wire += size(tools)
  upfront += count(tools)
  const listed: Named[] = noun ? ((await client.request({ method: `${noun}/list`, params: {} }, Loose)) as Record<string, Named[]>)[noun]! : []
  wire += size(listed)
  upfront += count(listed)
  const entries = sep2640 ? (await sep2640.list()).skills : []
  wire += size(entries)
  upfront += count(entries.map((entry) => entry.frontmatter))
  const listedResources = caps.resources ? (await client.listResources()).resources.map((resource) => resource.uri) : []

  if (variant === 'opt3') {
    const failure = await new SkillsClient(client).list().then(() => undefined, (error: unknown) => (error instanceof Error ? error.message : String(error)))
    const reason = failure?.split('\n').slice(0, 2).join(' ').replace(/Invalid input: expected \w+, received undefined/g, 'missing').slice(0, 160)
    notes.push(reason ? `a SEP-2640 skills client fails: ${reason}` : 'a SEP-2640 skills client parsed skills/list')
  }

  // Commit to "set up Turnstile": load the instructions and the tool definitions the workflow needs.
  const entry = listed.find((item) => item.name === task.skill)
  let scopedTool: Tool | undefined
  if (noun && entry) {
    const got = (await client.request({ method: `${noun}/get`, params: { name: entry.name } }, Loose)) as Body
    scopedTool = got.tools?.[0]
    wire += size(got)
    taskLoad += count(got.instructions ?? '') + count(got.tools ?? []) + count(got.resources ?? [])
    taskTools = got.tools?.length ?? 0
    const names = new Set(got.tools?.map((tool) => tool.name))
    const missing = [...(got.instructions ?? '').matchAll(/\b[A-Za-z]+_[A-Za-z_]+/g)].map((m) => m[0]).filter((name) => isTaskTool(name) && !names.has(name))
    if (missing.length > 0) notes.push(`instructions name tools not returned: ${missing.join(', ')}`)
    const conflicts = (got.resources ?? []).filter((resource) => listedResources.includes(resource.uri))
    notes.push(conflicts.length > 0 ? `placement: ${conflicts.map((r) => r.uri).join(', ')} is both scoped and in resources/list` : 'placement: no scoped resource is also in resources/list')
    const refs = [...(got.instructions ?? '').matchAll(/\]\((references\/[^)]+)\)/g)].map((m) => m[1]!)
    if (refs.length > 0) {
      const matched = refs.filter((ref) => got.resources?.some((resource) => resource.uri.endsWith(`/${task.skill}/${ref}`))).length
      notes.push(`${refs.length} relative links in instructions (e.g. ${refs[0]}); ${matched} match a scoped resource only if the host takes skill://${task.skill}/ as their base, which the response does not state`)
    }
    const skillRef = got.resources?.find((resource) => resource.uri.endsWith('/SKILL.md'))
    if (skillRef && sep2640) {
      const { skill } = await sep2640.get(skillRef.uri)
      const manifest = await sep2640.read(skill)
      wire += size(skill) + (manifest.body ?? '').length
      taskLoad += count(manifest.body ?? '')
      notes.push(`group lists ${skillRef.uri}; skills/get + read verified=${manifest.verified}; listed in skills/list: ${entries.some((e) => e.uri === skillRef.uri)}`)
    }
    if (variant === 'opt1') notes.push('no skill: the workflow prose is authored in the group and drops the skill\'s reference files')
    if (variant === 'opt3') notes.push('SKILL.md body delivered as instructions: no skill entry, no digests')
  } else if (sep2640) {
    const skill = entries.find((candidate) => candidate.frontmatter.name === task.skill)
    if (skill) {
      const manifest = await sep2640.read(skill)
      wire += (manifest.body ?? '').length
      taskLoad += count(manifest.body ?? '')
      taskTools = tools.filter((tool) => isTaskTool(tool.name)).length
      notes.push(`skill verified=${manifest.verified}; the skill names no tools, so all ${tools.length} tools stay in front of the model`)
    }
  }
  await client.close()

  // Discovery gating is not access control: a scoped tool is callable on a connection that never fetched its group.
  if (noun && scopedTool) {
    const fresh = await connect(variant, true)
    const inTools = (await fresh.listTools()).tools.some((tool) => tool.name === scopedTool.name)
    const result = (await fresh.callTool({ name: scopedTool.name, arguments: argsFor(scopedTool) })) as { isError?: boolean; content?: { text?: string }[] }
    const text = result.content?.[0]?.text ?? ''
    const ran = !result.isError && text.includes('"dryRun": true')
    notes.push(`${scopedTool.name} ${ran ? 'ran' : `did not run (${text.slice(0, 80)})`} on a connection with no ${noun}/get; in that connection's tools/list: ${inTools}`)
    await fresh.close()
  }

  // A client that never negotiated the extension.
  const legacy = await connect(variant, false)
  const legacyTools = (await legacy.listTools()).tools.length
  if (noun) {
    const refused = await legacy.request({ method: `${noun}/list`, params: {} }, Loose).then(() => false, () => true)
    if (!refused) notes.push(`${noun}/list answered a client that did not negotiate it`)
  }
  await legacy.close()

  return { variant, task, wire, upfront, taskLoad, taskTools, legacyTools, notes }
}

const rows: Row[] = []
for (const variant of VARIANTS) {
  for (const task of TASKS) {
    try {
      rows.push(await run(variant, task))
    } catch (error) {
      console.error(`${variant} / ${task.skill}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

const total = rows[0] ? rows[0].legacyTools : 0
console.log(`${total} tools. One task per cloudflare/skills workflow: ${TASKS.map((task) => `${task.label} (${task.skill})`).join(', ')}.`)
console.log('Token counts are tiktoken o200k_base over the compact JSON the model would see.\n')
console.log('| Variant | Task | Upfront tokens | Task-load tokens | Task tools | Tools for a 2025 client | Bytes on the wire |')
console.log('| :-- | :-- | --: | --: | --: | --: | --: |')
for (const row of rows) console.log(`| ${row.variant} | ${row.task.label} | ${row.upfront} | ${row.taskLoad} | ${row.taskTools} | ${row.legacyTools} | ${row.wire} |`)
console.log()
for (const row of rows) {
  console.log(`${row.variant} / ${row.task.skill}:`)
  for (const note of row.notes) console.log(`  - ${note}`)
}
