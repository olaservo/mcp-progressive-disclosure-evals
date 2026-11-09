import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server'
import { createServer, isVariant, VARIANTS, type Variant } from './variants.js'

interface Env {
  /** Set per deployment in wrangler.jsonc. The variant served at /mcp. */
  VARIANT?: string
  /** The Workers Rate Limiting binding from wrangler.jsonc. Absent in a config without one. */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}

const handlers = new Map<Variant, McpHttpHandler>()
function handlerFor(variant: Variant): McpHttpHandler {
  let handler = handlers.get(variant)
  if (!handler) {
    handler = createMcpHandler(() => createServer(variant), { responseMode: 'json' })
    handlers.set(variant, handler)
  }
  return handler
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    // /mcp serves this deployment's variant; /<variant>/mcp serves any variant.
    const match = /^\/(?:([a-z0-9-]+)\/)?mcp$/.exec(path)
    const variant = match ? (match[1] ?? env.VARIANT) : undefined
    if (variant && isVariant(variant)) {
      // The Workers take no auth. One client gets 120 requests a minute per location; past that, 429.
      if (env.RATE_LIMITER) {
        const key = request.headers.get('cf-connecting-ip') ?? 'unknown'
        const { success } = await env.RATE_LIMITER.limit({ key })
        if (!success) return new Response('Rate limit: 120 requests per minute per client. Try again shortly.\n', { status: 429, headers: { 'content-type': 'text/plain', 'retry-after': '60' } })
      }
      return handlerFor(variant).fetch(request)
    }
    if (path === '/') {
      const lines = Object.entries(VARIANTS).map(([name, about]) => `/${name}/mcp  ${about}`)
      if (env.VARIANT) lines.unshift(`/mcp  ${env.VARIANT}`)
      return new Response(lines.join('\n') + '\n', { headers: { 'content-type': 'text/plain' } })
    }
    return new Response('Not Found', { status: 404 })
  }
}
