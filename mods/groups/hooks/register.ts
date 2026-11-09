import type { EngineInterface, Register } from 'claude-code'

/**
 * A Claude Code mod that implements the Groups extension (progressive-disclosure-wg#19 at 15b2a5c) to a
 * server over streamable HTTP, the way the SEP's "Client behavior after groups/get" section sketches:
 * client-side helper tools the model calls, and scoped tools registered mid-session once a group is open.
 *
 * The engine's own MCP path cannot reach a groups server: $.mcp.call resolves against tools/list, and
 * a groups server keeps scoped tools out of it and answers custom methods. So the mod sends JSON-RPC
 * itself with $.http.fetch. The 2026-07-28 transport takes one stateless POST per request: the method
 * in an mcp-method header, the tool name in mcp-name on tools/call, and the protocol version and
 * client capabilities in params._meta. No initialize, no session id.
 *
 * Flow:
 *   session.start   register list_groups, open_group and read_skill; fetch groups/list and skills/list
 *   prompt.compose  one session-scoped section listing the groups and skills as names and descriptions
 *   list_groups     groups/list, as text
 *   open_group      groups/get; register each scoped tool (deferred by default); return the instructions,
 *                   the tool names, and the body of any SKILL.md the group lists
 *   read_skill      resources/read of skill://<name>/SKILL.md, for skills no group lists
 *   scoped call     tools/call, result verbatim
 */

const PLUGIN = 'groups'
const GROUPS_EXT = 'io.modelcontextprotocol/groups'
const SKILLS_EXT = 'io.modelcontextprotocol/skills'
const PROTOCOL = '2026-07-28'

type Named = { name: string; title?: string; description?: string }
type Tool = { name: string; description?: string; inputSchema?: Record<string, unknown> }
type Resource = { uri: string; name?: string; description?: string; mimeType?: string }
type GroupBody = { instructions?: string; tools?: Tool[]; resources?: Resource[]; groups?: Named[] }
type SkillEntry = { uri: string; frontmatter: { name: string; description?: string } }
type Content = { type: string; text?: string }
type CallResult = { content?: Content[]; isError?: boolean }
type ReadResult = { contents?: { uri: string; text?: string }[] }
type RpcMessage = { id?: number; result?: unknown; error?: { code: number; message: string } }

const prefix = `mcp__${PLUGIN}__`
const short = (full: string) => (full.startsWith(prefix) ? full.slice(prefix.length) : full)
const firstLine = (text = '') => text.split('\n')[0]!.trim()

// Module state. A reload starts it over, which a headless run never sees.
let groups: Named[] = []
let skills: SkillEntry[] = []
let catalogError: string | undefined
/** Scoped tool name -> the group it was opened from. */
const scopedToGroup = new Map<string, string>()
/** Scoped tool name -> its description, for a stable tool.describe answer. */
const scopedDescription = new Map<string, string>()
const opened: string[] = []

let rpcSeq = 0
/**
 * One JSON-RPC request as one POST. The transport wants the target's identifier in an mcp-name header as well
 * as in the body: `params.name` for tools/call and groups/get, `params.uri` for resources/read.
 */
async function rpc<T>($: EngineInterface, url: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
  const id = ++rpcSeq
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': PROTOCOL,
    'mcp-method': method
  }
  const target = typeof params.name === 'string' ? params.name : typeof params.uri === 'string' ? params.uri : undefined
  if (target !== undefined) headers['mcp-name'] = target
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': PROTOCOL,
        'io.modelcontextprotocol/clientCapabilities': { extensions: { [GROUPS_EXT]: {}, [SKILLS_EXT]: {} } }
      }
    }
  })
  const response = await $.http.fetch(url, { method: 'POST', headers, body })
  const message = parseMessage(response.text, id)
  if (!response.ok && !message) throw new Error(`${method}: HTTP ${response.status} ${response.text.slice(0, 200)}`)
  if (!message) throw new Error(`${method}: no JSON-RPC response (HTTP ${response.status})`)
  if (message.error) throw new Error(`${method}: ${message.error.message}`)
  return message.result as T
}

/** The response as JSON, or as the first matching `data:` line of an SSE body. */
function parseMessage(text: string, id: number): RpcMessage | undefined {
  const candidates = text.trimStart().startsWith('{')
    ? [text]
    : text.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as RpcMessage
      if (parsed.id === undefined || parsed.id === id) return parsed
    } catch {
      continue
    }
  }
  return undefined
}

async function loadCatalog($: EngineInterface, url: string, listSkills: boolean): Promise<void> {
  try {
    groups = ((await rpc<{ groups?: Named[] }>($, url, 'groups/list')).groups ?? [])
    catalogError = undefined
  } catch (error) {
    groups = []
    catalogError = error instanceof Error ? error.message : String(error)
  }
  skills = []
  if (listSkills) {
    try {
      const listed = (await rpc<{ skills?: SkillEntry[] }>($, url, 'skills/list')).skills ?? []
      // Option 3 serves renamed groups under the Skills identifier; its entries carry no frontmatter and drop out.
      skills = listed.filter((entry) => entry.frontmatter?.name)
    } catch {
      skills = []
    }
  }
  $.ui.status(groups.length ? `${groups.length} groups` : undefined)
}

/**
 * What the model reads before it picks: the same lines the selection trial shows. A server with no groups
 * (the flat variant, which serves only skills) gets the skills part alone.
 */
function section(): string | undefined {
  if (groups.length === 0 && skills.length === 0) return undefined
  const lines: string[] = []
  if (groups.length > 0) {
    lines.push(
      '# Capability groups over MCP',
      'This session is connected to an MCP server that discloses its tools in groups. Specialized tools are not',
      'loaded up front: each group bundles related tools that become callable only after you open the group.',
      'When a task matches a group below, call open_group with its name first, then use the tools it reveals.',
      'A group may also carry a skill, whose instructions open_group returns; follow them. Call list_groups to',
      're-list at any time.',
      '',
      "Groups (open_group loads a group's tools and instructions):",
      ...groups.map((g) => `- ${g.name}: ${firstLine(g.description)}`)
    )
  } else {
    lines.push('# Skills over MCP', 'The MCP server in this session serves these skills. When a task matches one, call read_skill with its name before starting, then follow it.')
  }
  if (skills.length > 0) lines.push('', "Skills (read_skill loads a skill's instructions):", ...skills.map((s) => `- ${s.frontmatter.name}: ${firstLine(s.frontmatter.description)}`))
  return lines.join('\n')
}

function textOf(result: CallResult): string {
  return (result.content ?? []).map((c) => (c.type === 'text' && typeof c.text === 'string' ? c.text : JSON.stringify(c))).join('\n')
}

export const register: Register = (on, options) => {
  const url = String(options.url ?? 'https://pd-groups-opt2.olahungerford.workers.dev/mcp')
  const deferScoped = options.deferScoped !== false
  const listSkills = options.listSkills !== false

  on('session.start', async ($, e, next) => {
    await loadCatalog($, url, listSkills)
    // The group tools only when the server has groups; a skills-only server gets read_skill alone.
    if (groups.length > 0 || catalogError === undefined) {
      await $.tool.register({
        name: 'list_groups',
        description: 'List the capability groups the MCP server offers, each with a name and a description of when to use it. Call this to discover what is available before using a specialized tool.',
        inputSchema: { type: 'object', properties: {} },
        isDeferred: false
      })
      await $.tool.register({
        name: 'open_group',
        description: 'Open a capability group by name. Returns its instructions and makes its scoped tools callable for the rest of the session. Always open the relevant group before calling a specialized tool.',
        inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'The group name to open.' } }, required: ['name'] },
        isDeferred: false
      })
    }
    if (skills.length > 0) {
      await $.tool.register({
        name: 'read_skill',
        description: "Read a skill's instructions (its SKILL.md) by skill name, or one of the skill's files by `<skill>/<path>` (for example `turnstile-spin/references/react.md`).",
        inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'The skill name, or <skill>/<path> for one of its files.' } }, required: ['name'] },
        isDeferred: false
      })
    }
    await $.command.register({ name: 'groups', description: 'Show the groups server, the catalog, and which groups are open' })
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    const text = section()
    if (!text || e.traits.includes('bare')) return composed
    return { sections: [...composed.sections, { id: 'groups:catalog', text, scope: 'session' as const }] }
  })

  on('command.run', { command: 'groups' }, async ($) => {
    await loadCatalog($, url, listSkills)
    const lines = [`Server: ${url}`, catalogError ? `groups/list failed: ${catalogError}` : `${groups.length} groups, ${skills.length} skills`, `Open: ${opened.length ? opened.join(', ') : 'none'}`, `Scoped tools registered: ${scopedToGroup.size}`]
    return { text: lines.join('\n') }
  })

  on('tool.call', async ($, e, next) => {
    const name = short(e.tool)
    const args = e as unknown as Record<string, unknown>

    if (name === 'list_groups') {
      await loadCatalog($, url, listSkills)
      if (catalogError) return { deny: `list_groups failed: ${catalogError}` }
      if (groups.length === 0) return { result: 'The server offers no groups.' }
      return { result: ['Available groups:', ...groups.map((g) => `- ${g.name}: ${firstLine(g.description)}`)].join('\n') }
    }

    if (name === 'open_group') {
      const groupName = String(args.name ?? '').trim()
      if (!groupName) return { deny: 'open_group requires a group name.' }
      let body: GroupBody
      try {
        body = await rpc<GroupBody>($, url, 'groups/get', { name: groupName })
      } catch (error) {
        return { deny: `open_group '${groupName}' failed: ${error instanceof Error ? error.message : String(error)}` }
      }
      const tools = body.tools ?? []
      // Fill the maps before registering: the engine may ask tool.describe during registration, and a
      // tool the maps do not know yet would land resident and rewrite the cached prefix.
      for (const tool of tools) {
        const isNew = !scopedToGroup.has(tool.name)
        scopedToGroup.set(tool.name, groupName)
        scopedDescription.set(tool.name, tool.description ?? '')
        if (isNew) {
          await $.tool.register({ name: tool.name, description: tool.description ?? '', inputSchema: tool.inputSchema ?? { type: 'object' }, isDeferred: deferScoped })
        }
      }
      if (!opened.includes(groupName)) opened.push(groupName)

      const out: string[] = [`Opened '${groupName}'.`]
      if (body.instructions) out.push('', 'Instructions:', body.instructions)
      out.push('', tools.length ? `Tools now available: ${tools.map((t) => t.name).join(', ')}` : 'This group has no tools.')
      if (body.groups?.length) out.push('', `Nested groups (open with open_group): ${body.groups.map((g) => `${g.name}: ${firstLine(g.description)}`).join('; ')}`)
      const resources = body.resources ?? []
      const skillDocs = resources.filter((r) => r.uri.endsWith('/SKILL.md'))
      const others = resources.filter((r) => !r.uri.endsWith('/SKILL.md'))
      for (const doc of skillDocs) {
        try {
          const read = await rpc<ReadResult>($, url, 'resources/read', { uri: doc.uri })
          const text = (read.contents ?? []).map((c) => c.text ?? '').join('\n')
          const root = doc.uri.replace(/\/SKILL\.md$/, '')
          out.push('', `Skill ${doc.uri} (paths it mentions are relative to ${root}/):`, text)
        } catch (error) {
          out.push('', `Skill ${doc.uri} could not be read: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      if (others.length) out.push('', `Resources: ${others.map((r) => r.uri).join(', ')}`)
      return { result: out.join('\n') }
    }

    if (name === 'read_skill') {
      const skillName = String(args.name ?? '').trim().replace(/^skill:\/\//, '').replace(/^\/+|\/+$/g, '')
      const entry = skills.find((s) => s.frontmatter.name === skillName)
      // A bare skill name reads its SKILL.md; `<skill>/<path>` reads that file of the skill.
      const uri = skillName.includes('/') ? `skill://${skillName}` : (entry?.uri ?? `skill://${skillName}/SKILL.md`)
      const root = uri.includes('/SKILL.md') ? uri.replace(/\/SKILL\.md$/, '') : `skill://${skillName.split('/')[0]}`
      try {
        const read = await rpc<ReadResult>($, url, 'resources/read', { uri })
        const text = (read.contents ?? []).map((c) => c.text ?? '').join('\n')
        if (!text) return { deny: `read_skill: ${uri} is empty or not served.` }
        return { result: `${uri} (paths it mentions are relative to ${root}/):\n${text}` }
      } catch (error) {
        return { deny: `read_skill '${skillName}' failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }

    if (scopedToGroup.has(name)) {
      const { tool: _tool, tool_use_id: _id, consent: _consent, ...callArgs } = args
      try {
        const result = await rpc<CallResult>($, url, 'tools/call', { name, arguments: callArgs })
        const text = textOf(result)
        return result.isError ? { deny: text || `${name} failed` } : { result: text }
      } catch (error) {
        return { deny: `${name} failed: ${error instanceof Error ? error.message : String(error)}` }
      }
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: the groups hook failed on ${e.tool}.` }))

  // Scoped tools stay deferred (or resident, by option) so that disclosing them mid-session is cache-safe.
  on('tool.describe', ($, e, next) => {
    const name = short(e.tool)
    if (scopedToGroup.has(name)) return { description: scopedDescription.get(name) ?? '', isDeferred: deferScoped }
    return next(e)
  })
}
