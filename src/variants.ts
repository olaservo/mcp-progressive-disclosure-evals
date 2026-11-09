import { McpServer, ProtocolError, ResourceTemplate, type CallToolResult, type Resource, type Tool } from '@modelcontextprotocol/server'
import { memorySkillFiles, SkillsExtension, type SkillCatalog } from '@modelcontextprotocol/server/ext/skills'
import { buildRequest } from './vendor/forge/_/tool.js'
import { SOURCE, skillFiles } from './vendor/skills.js'
import { attachGroups, clientNegotiated, GROUPS_NAMING, type Group, type Naming, type ServedGroup } from './groups.js'
import { WORKFLOWS, forgeToolsByName, productToolsets, skillFilePaths, skillFrontmatter, wireTool, workflowTools, type Toolset, type Workflow } from './catalog.js'

export const VARIANTS = {
  flat: "Today's cloudflare/mcp direct-tool mode, which is also Option 1's Skills server: every tool in tools/list, skills over the Skills extension.",
  opt1: "Option 1's Groups server: groups only, with the workflow written into group instructions. No skills.",
  opt2: 'Option 2: the Skills extension unchanged, plus groups. A workflow group scopes its tools and lists the skill\'s SKILL.md in resources.',
  opt3: 'Option 3: Groups renamed to Skills. skills/list and skills/get serve code-defined skills; each SKILL.md folder maps to instructions plus scoped resources.'
} as const
export type Variant = keyof typeof VARIANTS
export const isVariant = (value: string): value is Variant => Object.hasOwn(VARIANTS, value)

const SKILLS_EXTENSION_ID = 'io.modelcontextprotocol/skills'
/** Option 3 takes over the Skills extension's identifier and method names. */
const OPT3_NAMING: Naming = { extensionId: SKILLS_EXTENSION_ID, noun: 'skills' }
const API_BASE = 'https://api.cloudflare.com/client/v4'
const HOUR = { ttlMs: 60 * 60 * 1000, cacheScope: 'public' } as const

const INFO_TOOL: Tool = {
  name: 'demo_info',
  title: 'About this server',
  description: 'Which positioning option this server demonstrates and where its tools and skills come from.',
  inputSchema: { type: 'object', properties: {} },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
}

const allForgeTools = () => [...forgeToolsByName.values()].map(wireTool)

// ---- Groups ---------------------------------------------------------------------------------

function toolsetGroups(): ServedGroup[] {
  const asGroup = (set: Toolset): Group => ({ name: set.name, title: set.title, description: set.description })
  return productToolsets().flatMap((product) => {
    const children = product.children.filter((child) => child.tools.length > 0)
    return [
      { group: asGroup(product), topLevel: true, tools: product.tools.map(wireTool), children: children.map(asGroup) },
      ...children.map((child) => ({ group: asGroup(child), topLevel: false, tools: child.tools.map(wireTool) }))
    ]
  })
}

const withTools = (workflow: Workflow) => workflowTools(workflow).length > 0
const toolNamesLine = (workflow: Workflow) => `Tools in this group: ${workflowTools(workflow).map((tool) => tool.name).join(', ')}.`

/** Option 1: the group author restates the workflow. Nothing points at the skill. */
function opt1WorkflowGroups(): ServedGroup[] {
  return WORKFLOWS.filter(withTools).map((workflow) => {
    const { description } = skillFrontmatter(workflow.skill)
    return {
      group: { name: workflow.skill, title: workflow.skill, description },
      topLevel: true,
      instructions: `${workflow.authoredInstructions}\n\n${toolNamesLine(workflow)}`,
      tools: workflowTools(workflow).map(wireTool)
    }
  })
}

/**
 * Option 2, following #22's Example 3: the group has the skill's name, scopes the tools, and lists the
 * skill's SKILL.md as an ordinary resource. Its instructions cover only its own tools. The skill is
 * still identified, verified and activated under the Skills extension.
 */
function opt2WorkflowGroups(): ServedGroup[] {
  return WORKFLOWS.filter(withTools).map((workflow) => {
    const { name, description } = skillFrontmatter(workflow.skill)
    const skill: Resource = { uri: `skill://${workflow.skill}/SKILL.md`, name, description, mimeType: 'text/markdown' }
    return {
      group: { name, title: name, description },
      topLevel: true,
      instructions: `Follow the ${name} skill for the procedure. These tools call the Cloudflare API and change account state, so confirm the target account and zone with the user first.\n\n${toolNamesLine(workflow)}`,
      tools: workflowTools(workflow).map(wireTool),
      resources: [skill]
    }
  })
}

/** Option 3: every skill is code-defined. A SKILL.md folder maps to its body as instructions and its other files as scoped resources. */
function opt3Skills(): ServedGroup[] {
  return WORKFLOWS.map((workflow) => {
    const { name, description, body } = skillFrontmatter(workflow.skill)
    const resources: Resource[] = skillFilePaths(workflow.skill)
      .filter((path) => path !== `${workflow.skill}/SKILL.md`)
      .map((path) => ({ uri: `skill://${path}`, name: path.slice(workflow.skill.length + 1), mimeType: mimeOf(path) }))
    return { group: { name, title: name, description }, topLevel: true, instructions: body, tools: workflowTools(workflow).map(wireTool), resources }
  })
}

function mimeOf(path: string): string {
  if (path.endsWith('.md')) return 'text/markdown'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.ts') || path.endsWith('.js')) return 'text/javascript'
  return 'text/plain'
}

// ---- Skills (SEP-2640) ----------------------------------------------------------------------

let catalog: Promise<SkillCatalog> | undefined
const skillCatalog = () => (catalog ??= SkillsExtension.load(memorySkillFiles(skillFiles), { cacheHint: HOUR, pageSize: Infinity }))

/**
 * The SDK catalog lists every SKILL.md in resources/list. Option 2 scopes the SKILL.md in a group, and the
 * SEP's placement rule forbids a resource being both scoped and listed. This source serves the same entries
 * through skills/list, skills/get and resources/read, and lists nothing in resources/list.
 */
async function unlistedSkills(): Promise<SkillsExtension> {
  const { entries } = await skillCatalog()
  return new SkillsExtension({
    cacheHint: HOUR,
    source: {
      list: async () => ({ skills: [...entries] }),
      get: async (uri) => entries.find((entry) => entry.uri === uri),
      read: async (uri) => {
        const text = skillFiles[uri.slice('skill://'.length)]
        return text === undefined ? undefined : { text, mimeType: mimeOf(uri) }
      }
    }
  })
}

// ---- Server ---------------------------------------------------------------------------------

const groupsByVariant = new Map<Variant, ServedGroup[]>()
function groupsFor(variant: Variant): ServedGroup[] | undefined {
  const build = { opt1: () => [...opt1WorkflowGroups(), ...toolsetGroups()], opt2: () => [...opt2WorkflowGroups(), ...toolsetGroups()], opt3: () => [...opt3Skills(), ...toolsetGroups()] }[
    variant as 'opt1' | 'opt2' | 'opt3'
  ]
  if (!build) return undefined
  if (!groupsByVariant.has(variant)) groupsByVariant.set(variant, build())
  return groupsByVariant.get(variant)
}

export async function createServer(variant: Variant): Promise<McpServer> {
  const mcp = new McpServer({ name: `cloudflare-groups-demo-${variant}`, version: '0.2.0' }, { instructions: VARIANTS[variant] })
  const groups = groupsFor(variant)
  const naming = variant === 'opt3' ? OPT3_NAMING : GROUPS_NAMING

  if (variant === 'flat') (await skillCatalog()).attach(mcp)
  if (variant === 'opt2') (await unlistedSkills()).attach(mcp)
  if (groups) attachGroups(mcp, groups, naming)

  if (variant === 'opt3') {
    // Scoped skill files: readable by URI, never listed.
    mcp.registerResource('skill-files', new ResourceTemplate('skill://{+path}', { list: undefined }), { cacheHint: HOUR }, (uri) => {
      const path = uri.href.slice('skill://'.length)
      const text = skillFiles[path]
      if (text === undefined || path.endsWith('/SKILL.md')) throw new ProtocolError(-32002, `No resource at ${uri.href}`)
      return { contents: [{ uri: uri.href, mimeType: mimeOf(path), text }] }
    })
  }

  mcp.server.registerCapabilities({ tools: { listChanged: false } })
  mcp.server.setRequestHandler('tools/list', async (_request, ctx) => {
    // Graceful degradation: a client that did not negotiate the extension gets the flattened list.
    const scoped = groups !== undefined && clientNegotiated(ctx, naming.extensionId)
    return { tools: scoped ? [INFO_TOOL] : [INFO_TOOL, ...allForgeTools()], ...HOUR }
  })
  mcp.server.setRequestHandler('tools/call', async (request) => callTool(variant, request.params.name, request.params.arguments ?? {}))
  return mcp
}

/**
 * Scoped tools stay callable whether or not their group was fetched: discovery gating is not access
 * control. Calls are dry runs that return the Cloudflare API request the tool would send.
 */
function callTool(variant: Variant, name: string, args: Record<string, unknown>): CallToolResult {
  if (name === INFO_TOOL.name) {
    return { content: [{ type: 'text', text: JSON.stringify({ variant, about: VARIANTS[variant], source: SOURCE }, null, 2) }] }
  }
  const tool = forgeToolsByName.get(name)
  if (!tool) return { isError: true, content: [{ type: 'text', text: `Tool ${name} not found` }] }
  try {
    const request = buildRequest(tool, args, API_BASE)
    return { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, note: 'Not sent. This is the request the tool would make.', request }, null, 2) }] }
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] }
  }
}
