import { expect, test } from 'claude-code/testing'

// A groups server, canned. The hooks beneath the plugin stand for the engine: $.http.fetch is answered
// here by method header, and each request is recorded so the test can check what the mod sent.
type Sent = { url: string; method?: string; name?: string; body: Record<string, unknown> }

function server() {
  const sent: Sent[] = []
  const answer = (e: Record<string, unknown>) => {
    const init = (e.init ?? {}) as { headers?: Record<string, string>; body?: string }
    const headers = init.headers ?? {}
    const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>
    const method = headers['mcp-method']
    sent.push({ url: String(e.url), method, name: headers['mcp-name'], body })
    const params = (body.params ?? {}) as Record<string, unknown>
    let result: unknown
    switch (method) {
      case 'groups/list':
        result = { groups: [{ name: 'turnstile-spin', description: 'Set up Turnstile bot verification.' }, { name: 'kv-api', description: 'Call the KV API directly.' }] }
        break
      case 'skills/list':
        result = { skills: [{ uri: 'skill://wrangler/SKILL.md', frontmatter: { name: 'wrangler', description: 'Run Wrangler CLI commands.' } }] }
        break
      case 'groups/get':
        if (params.name !== 'turnstile-spin') return { status: 200, ok: true, headers: {}, text: JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32002, message: `Not found: ${String(params.name)}` } }) }
        result = {
          instructions: 'Follow the turnstile-spin skill for the procedure.',
          tools: [{ name: 'turnstile_widgets_list', description: 'List widgets.', inputSchema: { type: 'object', properties: { path: { type: 'object' } } } }],
          resources: [{ uri: 'skill://turnstile-spin/SKILL.md', mimeType: 'text/markdown' }]
        }
        break
      case 'resources/read':
        result = { contents: [{ uri: params.uri, mimeType: 'text/markdown', text: `# Body of ${String(params.uri)}` }] }
        break
      case 'tools/call':
        result = { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, tool: params.name, arguments: params.arguments }) }] }
        break
      default:
        return { status: 400, ok: false, headers: {}, text: JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `Unknown method ${String(method)}` } }) }
    }
    return { status: 200, ok: true, headers: { 'content-type': 'application/json' }, text: JSON.stringify({ jsonrpc: '2.0', id: body.id, result }) }
  }
  return { sent, answer }
}

const URL = 'https://groups.example/mcp'

test('open_group registers the scoped tools and routes their calls', { options: { url: URL } }, async ($, on) => {
  const { sent, answer } = server()
  const registered: string[] = []
  on('http.fetch', (_, e) => ({ value: answer(e as unknown as Record<string, unknown>) }))
  on('tool.register', (_, e) => {
    registered.push((e as { name: string }).name)
    return { value: { tool: `mcp__groups__${(e as { name: string }).name}` } }
  })
  on('command.register', () => ({ value: { command: 'groups' } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ deny: 'no tool beneath the mod should run' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })

  // session.start registers the three helpers and reads the catalog with the per-request envelope.
  expect(registered.slice(0, 3).join(',')).toBe('list_groups,open_group,read_skill')
  const list = sent.find((s) => s.method === 'groups/list')
  expect(list?.url).toBe(URL)
  const meta = ((list?.body.params as Record<string, unknown>)._meta ?? {}) as Record<string, unknown>
  expect(meta['io.modelcontextprotocol/protocolVersion']).toBe('2026-07-28')
  expect(Object.keys(((meta['io.modelcontextprotocol/clientCapabilities'] as { extensions: object }).extensions)).join(',')).toBe('io.modelcontextprotocol/groups,io.modelcontextprotocol/skills')

  // Opening a group fetches it, registers its tool, and returns the instructions and the listed skill's body.
  const opened = await $.tool.call({ tool: 'mcp__groups__open_group', name: 'turnstile-spin' })
  const text = String(opened.result ?? '')
  expect(opened.deny).toBe(undefined)
  expect(text.includes('Follow the turnstile-spin skill')).toBe(true)
  expect(text.includes('Tools now available: turnstile_widgets_list')).toBe(true)
  expect(text.includes('# Body of skill://turnstile-spin/SKILL.md')).toBe(true)
  expect(registered.includes('turnstile_widgets_list')).toBe(true)
  expect(sent.find((s) => s.method === 'groups/get')?.name).toBe('turnstile-spin')
  expect(sent.find((s) => s.method === 'resources/read')?.name).toBe('skill://turnstile-spin/SKILL.md')

  // A scoped call goes to tools/call with the tool's own arguments and the mcp-name header.
  const ran = await $.tool.call({ tool: 'mcp__groups__turnstile_widgets_list', path: { account_id: 'demo' } })
  expect(ran.deny).toBe(undefined)
  expect(String(ran.result ?? '').includes('"dryRun":true')).toBe(true)
  const call = sent.find((s) => s.method === 'tools/call')
  expect(call?.name).toBe('turnstile_widgets_list')
  const params = call?.body.params as { name: string; arguments: Record<string, unknown> }
  expect(params.name).toBe('turnstile_widgets_list')
  expect(JSON.stringify(params.arguments)).toBe('{"path":{"account_id":"demo"}}')

  // Opening the same group again registers nothing new.
  const before = registered.length
  await $.tool.call({ tool: 'mcp__groups__open_group', name: 'turnstile-spin' })
  expect(registered.length).toBe(before)
})

test('an unknown group is refused and read_skill reads a listed skill', { options: { url: URL } }, async ($, on) => {
  const { sent, answer } = server()
  on('http.fetch', (_, e) => ({ value: answer(e as unknown as Record<string, unknown>) }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__groups__${(e as { name: string }).name}` } }))
  on('command.register', () => ({ value: { command: 'groups' } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })

  const missing = await $.tool.call({ tool: 'mcp__groups__open_group', name: 'no-such-group' })
  expect(String(missing.deny ?? '').includes('Not found: no-such-group')).toBe(true)

  const skill = await $.tool.call({ tool: 'mcp__groups__read_skill', name: 'wrangler' })
  expect(skill.deny).toBe(undefined)
  expect(String(skill.result ?? '').includes('# Body of skill://wrangler/SKILL.md')).toBe(true)
  expect(sent.find((s) => s.method === 'resources/read')?.name).toBe('skill://wrangler/SKILL.md')

  const listed = await $.tool.call({ tool: 'mcp__groups__list_groups' })
  expect(String(listed.result ?? '').includes('- kv-api: Call the KV API directly.')).toBe(true)
})
