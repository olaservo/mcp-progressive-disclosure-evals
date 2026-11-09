import type { Tool } from '@modelcontextprotocol/server'
import type { Tool as ForgeTool } from './vendor/forge/_/tool.js'
import { toolsets } from './vendor/forge-catalog.js'
import { skillFiles } from './vendor/skills.js'

/** A forge tool as tools/list and groups/get send it: no HTTP plan, no response schemas. */
export function wireTool(tool: ForgeTool): Tool {
  return {
    name: tool.name,
    ...(tool.title !== undefined && { title: tool.title }),
    description: tool.description,
    inputSchema: tool.inputSchema as Tool['inputSchema'],
    annotations: { ...tool.annotations }
  }
}

export const forgeToolsByName = new Map<string, ForgeTool>(
  toolsets.flatMap(({ tools }) => tools.map((tool) => [tool.name, tool] as const))
)

const kebab = (segment: string) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** Forge tools under a path prefix: `workers/scripts` takes `workers/scripts` and `workers/scripts/schedules`. */
export function toolsUnder(prefix: string, { exact = false } = {}): ForgeTool[] {
  return toolsets
    .filter(({ path }) => path === prefix || (!exact && path.startsWith(prefix + '/')))
    .flatMap(({ tools }) => tools)
}

/**
 * The product tree as two levels of toolset groups. Each product is `<product>-api` (a skill is already
 * called `durable-objects`, and group names share one namespace); each second-level directory is a
 * child group holding everything beneath it.
 */
export interface Toolset {
  name: string
  title: string
  description: string
  tools: ForgeTool[]
  children: Toolset[]
}

export function productToolsets(): Toolset[] {
  const products = [...new Set(toolsets.map(({ path }) => path.split('/')[0]!))]
  return products.map((product) => {
    const areas = [...new Set(toolsets.map(({ path }) => path.split('/')).filter((parts) => parts[0] === product && parts.length > 1).map((parts) => parts[1]!))]
    const label = kebab(product).replaceAll('-', ' ')
    return {
      name: `${kebab(product)}-api`,
      title: `Cloudflare ${label} API`,
      description: `Call the Cloudflare ${label} API directly. Use to read or change ${label} resources in an account.`,
      tools: toolsUnder(product, { exact: true }),
      children: areas.map((area) => {
        const areaLabel = kebab(area).replaceAll('-', ' ')
        return {
          name: `${kebab(product)}-${kebab(area)}`,
          title: `${label} ${areaLabel}`,
          description: `${label} API: ${areaLabel}.`,
          tools: toolsUnder(`${product}/${area}`),
          children: []
        }
      })
    }
  })
}

/** One cloudflare/skills skill and the forge toolsets its workflow drives. */
export interface Workflow {
  skill: string
  toolPaths: string[]
  /** What a group author writes when there is no skill to point to (Option 1). */
  authoredInstructions?: string
}

export const WORKFLOWS: Workflow[] = [
  {
    skill: 'turnstile-spin',
    toolPaths: ['turnstile/widgets'],
    authoredInstructions: [
      'Set up Cloudflare Turnstile for a site.',
      '1. List the account\'s widgets and reuse one whose domains already cover the site.',
      '2. Otherwise create a widget with the site\'s hostnames and mode "managed".',
      '3. Put the sitekey in the frontend widget and the secret in the backend environment.',
      '4. Verify every token server-side with Siteverify before trusting the request. Rotate the secret if it was ever exposed.'
    ].join('\n')
  },
  {
    skill: 'durable-objects',
    toolPaths: ['durableObjects/namespaces', 'durableObjects/namespaces/objects'],
    authoredInstructions: [
      'Inspect Durable Objects deployed in an account.',
      'List namespaces to find the class, then list its objects to see which IDs hold storage.',
      'Use the Workers tools to change the code; these tools only read namespaces and objects.'
    ].join('\n')
  },
  {
    skill: 'cloudflare-email-service',
    toolPaths: ['emailSending', 'emailSending/subdomains', 'emailRouting', 'emailRouting/rules', 'emailRouting/addresses', 'emailRouting/dns'],
    authoredInstructions: [
      'Configure Cloudflare Email Sending and Email Routing for a zone.',
      '1. Check the zone\'s Email Routing settings and DNS records; enable routing if it is off.',
      '2. Add and verify destination addresses before creating rules that forward to them.',
      '3. For sending, onboard a sending subdomain and confirm its DNS records before sending.',
      'Check SPF, DKIM and DMARC records whenever delivery fails.'
    ].join('\n')
  },
  // Knowledge and CLI skills: no API tools to pair with.
  { skill: 'workers-best-practices', toolPaths: [] },
  { skill: 'wrangler', toolPaths: [] }
]

export function workflowTools(workflow: Workflow): ForgeTool[] {
  const seen = new Set<string>()
  return workflow.toolPaths
    .flatMap((path) => toolsUnder(path, { exact: true }))
    .filter((tool) => !seen.has(tool.name) && seen.add(tool.name))
}

/** Name and description from a SKILL.md's single-line frontmatter. */
export function skillFrontmatter(skill: string): { name: string; description: string; body: string } {
  const text = skillFiles[`${skill}/SKILL.md`]
  if (!text) throw new Error(`No SKILL.md for ${skill}`)
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replaceAll('\r\n', '\n'))
  if (!match) throw new Error(`No frontmatter in ${skill}/SKILL.md`)
  const field = (key: string) => new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(match[1]!)?.[1]?.trim() ?? ''
  return { name: field('name'), description: field('description'), body: match[2]! }
}

export function skillFilePaths(skill: string): string[] {
  return Object.keys(skillFiles).filter((path) => path.startsWith(`${skill}/`))
}

// ---- The recommended server: one level, sized to a task ---------------------------------------

/**
 * A product stays one group unless it has more than this many tools or this many characters of tool JSON
 * (about 15k tokens). A larger product is split by its second-level directories.
 */
export const SPLIT_TOOLS = 25
export const SPLIT_CHARS = 60_000
/** An area with fewer tools joins the product's `-core` group. A `-core` group left this small joins the largest area. */
const MIN_AREA_TOOLS = 4

export interface FlatToolset {
  name: string
  product: string
  /** The forge paths the group holds, for the description script. */
  paths: string[]
  tools: ForgeTool[]
}

const wireChars = (tools: ForgeTool[]) => tools.reduce((sum, tool) => sum + JSON.stringify(wireTool(tool)).length, 0)

export function flatToolsets(): FlatToolset[] {
  const products = [...new Set(toolsets.map(({ path }) => path.split('/')[0]!))]
  return products.flatMap((product): FlatToolset[] => {
    const all = toolsUnder(product)
    const pathsUnder = (prefix: string, exact = false) => toolsets.map(({ path }) => path).filter((path) => path === prefix || (!exact && path.startsWith(prefix + '/')))
    if (all.length <= SPLIT_TOOLS && wireChars(all) <= SPLIT_CHARS) {
      return [{ name: `${kebab(product)}-api`, product, paths: pathsUnder(product), tools: all }]
    }
    const areas = [...new Set(toolsets.map(({ path }) => path.split('/')).filter((parts) => parts[0] === product && parts.length > 1).map((parts) => parts[1]!))]
    const core: FlatToolset = { name: `${kebab(product)}-core`, product, paths: pathsUnder(product, true), tools: toolsUnder(product, { exact: true }) }
    const groups: FlatToolset[] = []
    for (const area of areas) {
      const prefix = `${product}/${area}`
      const tools = toolsUnder(prefix)
      if (tools.length < MIN_AREA_TOOLS) {
        core.tools.push(...tools)
        core.paths.push(...pathsUnder(prefix))
      } else {
        groups.push({ name: `${kebab(product)}-${kebab(area)}`, product, paths: pathsUnder(prefix), tools })
      }
    }
    if (core.tools.length >= MIN_AREA_TOOLS || groups.length === 0) return [core, ...groups]
    const largest = groups.reduce((a, b) => (b.tools.length > a.tools.length ? b : a))
    largest.tools.push(...core.tools)
    largest.paths.push(...core.paths)
    return groups
  })
}

/** Workflow bundles for the recommended server: the skill plus the tools its procedure touches. A path takes its subdirectories unless it ends in `$`. */
export const REC_WORKFLOWS: { skill: string; toolPaths: string[]; description: string; instructions: string }[] = [
  {
    skill: 'turnstile-spin',
    toolPaths: ['turnstile/widgets'],
    description:
      "Set up a bot check (CAPTCHA alternative) on a site's forms end to end: create a Turnstile widget for the site's hostnames, add it to the frontend, verify the challenge token on the server with Siteverify, and rotate a leaked secret. Open this to add or repair bot protection on a site; open turnstile-api to list or edit existing widgets.",
    instructions: 'The turnstile-spin skill has the procedure: load skill://turnstile-spin/SKILL.md before starting.'
  },
  {
    skill: 'durable-objects',
    toolPaths: ['durableObjects'],
    description:
      'Write or review Durable Objects: stateful per-entity classes in a Worker (chat rooms, counters, rate limiters, coordination) with transactional storage, alarms that wake an object on a schedule, and WebSockets. Open this to build or review a Durable Object class; open durable-objects-api to list deployed namespaces and the objects that hold storage.',
    instructions: 'The durable-objects skill has the guidance: load skill://durable-objects/SKILL.md before writing or reviewing a class.'
  },
  {
    skill: 'cloudflare-email-service',
    toolPaths: ['emailSending$', 'emailSending/subdomains', 'emailRouting$', 'emailRouting/rules', 'emailRouting/addresses', 'emailRouting/dns', 'emailRouting/settings'],
    description:
      "Send and receive email on a domain end to end: forward an address to another inbox (Email Routing rules and verified destinations), send transactional mail such as receipts from a Worker (sending subdomains), and check or fix the SPF, DKIM and DMARC records. Open this to set up email; open email-routing-api or email-sending-api to change one existing setting.",
    instructions: 'The cloudflare-email-service skill has the procedure: load skill://cloudflare-email-service/SKILL.md before starting.'
  }
]

export function recWorkflowTools(paths: string[]): ForgeTool[] {
  const seen = new Set<string>()
  return paths.flatMap((path) => (path.endsWith('$') ? toolsUnder(path.slice(0, -1), { exact: true }) : toolsUnder(path))).filter((tool) => !seen.has(tool.name) && seen.add(tool.name))
}
