// Writes a task-vocabulary description for every opt2-rec product group that has no hand-written one, by giving a model
// the group's tool names and descriptions. Run it after `npm run vendor:full`; the result goes to
// src/group-descriptions.generated.json, which is committed and reviewed by hand. `npm run vendor` restores the subset after.
// Usage: tsx scripts/describe-groups.ts [--env <.env path>] [--model claude-sonnet-5-5] [--force] [--only a,b]
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { flatToolsets } from '../src/catalog.js'
import { GENERATED_DESCRIPTIONS, HAND_DESCRIPTIONS } from '../src/group-descriptions.js'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const model = opt('model', 'claude-sonnet-5-5')!
const force = args.includes('--force')
const only = opt('only')?.split(',')
const envFile = opt('env')
if (envFile) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim())
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, '')
  }
}

const OUT = 'src/group-descriptions.generated.json'
const EXAMPLES = ['r2-buckets', 'kv-api', 'queues-api', 'workers-versions'].map((name) => `${name}: ${HAND_DESCRIPTIONS[name]}`).join('\n')
const SYSTEM = [
  'You write the description of one tool group on an MCP server. An agent reads only the group names and descriptions and picks one group to open for a user task.',
  'Write one or two sentences, at most 60 words, plain text. Name the product, then list what the tools do in the words a user would use to describe the job (what they want to achieve), not the API path names.',
  'Cover every distinct capability in the tool list. Do not invent capabilities the tools do not have. No marketing words.',
  `Examples of the style:\n${EXAMPLES}`
].join('\n')

const sets = flatToolsets().filter((set) => !HAND_DESCRIPTIONS[set.name] && (only ? only.includes(set.name) : true))
const result: Record<string, string> = { ...GENERATED_DESCRIPTIONS }
const anthropic = new Anthropic()
let written = 0
for (const set of sets) {
  if (result[set.name] && !force) continue
  const tools = set.tools.map((tool) => `- ${tool.name}: ${tool.description.split('\n')[0]!.trim()}`).join('\n')
  const response = await anthropic.messages.create({
    model,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Group: ${set.name} (Cloudflare product directory ${set.paths[0]?.split('/')[0]})\nTools:\n${tools}\n\nReply with the description only.` }]
  })
  const text = response.content.filter((block) => block.type === 'text').map((block) => block.text).join('').trim().replace(/^["']|["']$/g, '')
  result[set.name] = text
  written++
  writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n')
  console.error(`${set.name} (${set.tools.length} tools): ${text}`)
}
console.error(`${written} written, ${sets.length - written} kept; ${Object.keys(result).length} in ${OUT}`)
