import * as z from 'zod/v4'
import { ProtocolError, type McpServer, type ServerContext } from '@modelcontextprotocol/server'
import type { Prompt, Resource, Tool } from '@modelcontextprotocol/server'

/**
 * The Groups extension as drafted in progressive-disclosure-wg#19
 * (seps/0000-progressive-disclosure-groups.md at 15b2a5c), written against SDK 2.4.0.
 * The WG prototype in #20 targets SDK 1.x and wraps the groups/get result in `contents`; this follows the SEP's flat shape.
 */
export const GROUPS_EXTENSION_ID = 'io.modelcontextprotocol/groups'
const CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities'
const RESOURCE_NOT_FOUND = -32002
const GROUP_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface Group {
  name: string
  title?: string
  description: string
  _meta?: Record<string, unknown>
}

/** A groups/get result: scoped primitives sit directly on the result, next to instructions. */
export interface GroupBody {
  instructions?: string
  tools?: Tool[]
  prompts?: Prompt[]
  resources?: Resource[]
  /** Child groups. Under Option 3's rename this key is `skills`. */
  children?: Group[]
}

export interface ServedGroup extends GroupBody {
  group: Group
  /** Listed in groups/list. Nested groups are reachable only through a parent's children. */
  topLevel: boolean
}

/**
 * The wire names. Groups by default. Option 3 renames the extension to Skills: `skills/list`,
 * `skills/get`, and `skills` for both the listing and the nested key.
 */
export interface Naming {
  extensionId: string
  noun: 'groups' | 'skills'
}
export const GROUPS_NAMING: Naming = { extensionId: GROUPS_EXTENSION_ID, noun: 'groups' }

/** The listing and every group's contents are the same for every caller here. */
const CACHE = { ttlMs: 60 * 60 * 1000, cacheScope: 'public' } as const

/** Whether the client declared the extension on this request (2026-07-28 per-request capabilities). */
export function clientNegotiated(ctx: ServerContext, extensionId = GROUPS_EXTENSION_ID): boolean {
  const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined
  const caps = envelope?.[CLIENT_CAPABILITIES_META_KEY] as { extensions?: Record<string, unknown> } | undefined
  return caps?.extensions?.[extensionId] !== undefined
}

export function attachGroups(mcp: McpServer, groups: readonly ServedGroup[], naming: Naming = GROUPS_NAMING): void {
  for (const { group } of groups) {
    if (group.name.length > 64 || !GROUP_NAME.test(group.name)) throw new Error(`Invalid group name: ${group.name}`)
  }
  const byName = new Map(groups.map((served) => [served.group.name, served]))
  const topLevel = groups.filter((served) => served.topLevel).map((served) => served.group)
  const { extensionId, noun } = naming

  mcp.server.registerCapabilities({ extensions: { [extensionId]: {} } })

  mcp.server.setRequestHandler(`${noun}/list`, { params: z.looseObject({ cursor: z.string().optional() }).optional() }, async (params, ctx) => {
    requireNegotiated(ctx, extensionId)
    if (params?.cursor !== undefined) throw new ProtocolError(-32602, 'Unknown cursor')
    return { [noun]: topLevel, ...CACHE }
  })

  mcp.server.setRequestHandler(`${noun}/get`, { params: z.looseObject({ name: z.string() }) }, async ({ name }, ctx) => {
    requireNegotiated(ctx, extensionId)
    const served = byName.get(name)
    if (!served) throw new ProtocolError(RESOURCE_NOT_FOUND, `Not found: ${name}`)
    const { instructions, tools, prompts, resources, children } = served
    return {
      ...(instructions !== undefined && { instructions }),
      ...(tools?.length && { tools }),
      ...(prompts?.length && { prompts }),
      ...(resources?.length && { resources }),
      ...(children?.length && { [noun]: children }),
      ...CACHE
    }
  })
}

function requireNegotiated(ctx: ServerContext, extensionId: string): void {
  // SEP: a server MUST NOT expect these requests from a client that has not declared support.
  // This server answers -32601 so the gap is visible in the comparison.
  if (!clientNegotiated(ctx, extensionId)) {
    throw new ProtocolError(-32601, `This method requires the ${extensionId} client extension`)
  }
}
