// Renames the vendor and its coined product names in a tool, so a catalog reads like one a model has not seen.
// A name is on the list when it does not say what the product does: "R2", "Spectrum", "Workers". Names that describe the
// product are left: "Email Routing", "Queues", "AI Gateway", "Page Rules", "Load Balancers". The API path line and URLs are
// dropped from descriptions, since both spell the product.
// Prose is matched with the capital letter, so "Access" the product is renamed and "access" the verb is not.

/** [pattern in prose, invented word]. Longer names come before the names they contain. */
const PROSE: [RegExp, string][] = [
  [/\bcloudflared\b/g, 'norvaled'],
  [/\bCloudflare\b/g, 'Norvale'],
  [/\bDurable Objects\b/g, 'Stenniks'],
  [/\bDurable Object\b/g, 'Stennik'],
  [/\bCloudforce One\b/g, 'Graystel'],
  [/\bSuper Slurper\b/g, 'Humbrel'],
  [/\bZero Trust\b/g, 'Bexmoor'],
  [/\bWorkers\b/g, 'Brimlets'],
  [/\bWorker\b/g, 'Brimlet'],
  [/\bPages\b/g, 'Quillo'],
  [/\bD1\b/g, 'Okari'],
  [/\bR2\b/g, 'Pellum'],
  [/\bKV\b/g, 'Dravo'],
  [/\bK2\b/g, 'Jorum'],
  [/\bSpectrum\b/g, 'Yarrowin'],
  [/\bTurnstile\b/g, 'Hespa'],
  [/\bZaraz\b/g, 'Mirelo'],
  [/\bHyperdrive\b/g, 'Canthex'],
  [/\bVectorize\b/g, 'Ulmary'],
  [/\bArgo\b/g, 'Feldon'],
  [/\bRadar\b/g, 'Sombrin'],
  [/\bStream\b/g, 'Tavique'],
  [/\bMagic\b/g, 'Orlis'],
  [/\bAccess\b/g, 'Lintra'],
  [/\bWARP\b/g, 'Nuvo'],
  [/\bFlagship\b/g, 'Kestrow'],
  [/\bMesh\b/g, 'Wendle'],
  [/\bLogpush\b/g, 'Ferrow'],
  [/\bSippy\b/g, 'Plimmo'],
  [/\bBasin\b/g, 'Corvane'],
  [/\bPrecursor\b/g, 'Altrin'],
  [/\bWrangler\b/g, 'Trovik']
]

/**
 * [words of a tool name, invented word, where]. A tool name is split at `_` and at capitals. `first` matches only at the
 * start of the name, so `pages_projects_list` is renamed and `customPages_list` is not.
 */
const NAME: [string[], string, 'any' | 'first'][] = [
  [['durable', 'objects'], 'stenniks', 'any'],
  [['cloudforce', 'one'], 'graystel', 'any'],
  [['super', 'slurper'], 'humbrel', 'any'],
  [['zero', 'trust'], 'bexmoor', 'any'],
  [['workers'], 'brimlets', 'any'],
  [['pages'], 'quillo', 'first'],
  [['d1'], 'okari', 'any'],
  [['r2'], 'pellum', 'any'],
  [['kv'], 'dravo', 'any'],
  [['k2'], 'jorum', 'any'],
  [['spectrum'], 'yarrowin', 'any'],
  [['turnstile'], 'hespa', 'any'],
  [['zaraz'], 'mirelo', 'any'],
  [['hyperdrive'], 'canthex', 'any'],
  [['vectorize'], 'ulmary', 'any'],
  [['argo'], 'feldon', 'any'],
  [['radar'], 'sombrin', 'first'],
  [['stream'], 'tavique', 'first'],
  [['magic'], 'orlis', 'any'],
  [['warp'], 'nuvo', 'any'],
  [['flagship'], 'kestrow', 'any'],
  [['mesh'], 'wendle', 'first'],
  [['logpush'], 'ferrow', 'any'],
  [['sippy'], 'plimmo', 'any'],
  [['basin'], 'corvane', 'any'],
  [['precursor'], 'altrin', 'any']
]

export function renameProse(text: string): string {
  let out = text.replace(/^(GET|POST|PUT|PATCH|DELETE) \/\S*\s*$/m, '').replace(/https?:\/\/[^\s)]+/g, '')
  for (const [pattern, word] of PROSE) out = out.replace(pattern, word)
  return out
}

export function renameName(name: string): string {
  let position = 0
  const segments = name.split('_').map((segment) => {
    const words = segment.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')
    const out: string[] = []
    for (let at = 0; at < words.length; ) {
      const rule = NAME.find(([match, , where]) => (where === 'any' || position === 0) && match.every((word, offset) => words[at + offset]?.toLowerCase() === word))
      out.push(rule ? rule[1] : words[at]!)
      at += rule ? rule[0].length : 1
      position++
    }
    // `access` is a product only under Zero Trust.
    if (out[0] === 'access' && name.startsWith('zeroTrust_')) out[0] = 'lintra'
    return out.map((word, at) => (at === 0 ? word[0]!.toLowerCase() + word.slice(1) : word[0]!.toUpperCase() + word.slice(1))).join('')
  })
  return segments.join('_')
}

type Listed = { name: string; title?: string; description?: string; inputSchema?: unknown }
const renameSchema = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(renameSchema)
  if (!node || typeof node !== 'object') return node
  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, key === 'description' && typeof value === 'string' ? renameProse(value) : renameSchema(value)]))
}

/** The tool as a renamed catalog would serve it. Argument names are kept, so a call made to it fits the original tool. */
export function renameTool<T extends Listed>(tool: T): T {
  return {
    ...tool,
    name: renameName(tool.name),
    ...(tool.title !== undefined && { title: renameProse(tool.title) }),
    ...(tool.description !== undefined && { description: renameProse(tool.description).trim() }),
    ...(tool.inputSchema !== undefined && { inputSchema: renameSchema(tool.inputSchema) })
  }
}
