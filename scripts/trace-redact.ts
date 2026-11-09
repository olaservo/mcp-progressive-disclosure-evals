// Prepares trace sessions for publication: keeps only the conversation rows, drops fields and rows that carry
// the machine, the account or the system prompt, scrubs paths, and refuses to write anything key-shaped.
//
// Usage: tsx scripts/trace-redact.ts [--label traces] [--out results/traces/<label>-public]
//
// What goes: every row type but `user` and `assistant` (api-request-blob and api-request-shape carry the full
// system prompt including the user's CLAUDE.md; attachment carries hook output; session-owner carries account ids;
// cost-state, tools-used, last-prompt, atis-latch and queue-operation are bookkeeping). On the kept rows: `cwd`,
// `gitBranch`, `userType`, `entrypoint`, `requestId`, `requestRef`, `serverClassifierRequest`, `advisorModel`,
// `wireToolInputs`, `toolInputStreamMs`. Any absolute path under the home directory becomes `<home>`.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const opt = (name: string, fallback?: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback)
const label = opt('label', 'traces')!
const src = resolve('results', 'traces', label)
const out = resolve(opt('out', join('results', 'traces', `${label}-public`))!)

const KEEP_TYPES = new Set(['user', 'assistant'])
const DROP_FIELDS = ['cwd', 'gitBranch', 'userType', 'entrypoint', 'requestId', 'requestRef', 'serverClassifierRequest', 'advisorModel', 'wireToolInputs', 'toolInputStreamMs', 'promptSource', 'turnOrigin']
// Provider-internal fields on the message object that carry nothing a reader needs.
const DROP_MESSAGE_FIELDS = ['input_transformations', 'diagnostics', 'context_management', 'container']
const home = homedir()
const homeForms = [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\'), '/c' + home.slice(2).replace(/\\/g, '/'), '/' + home[0]!.toLowerCase() + home.slice(2).replace(/\\/g, '/')]
const KEY_SHAPES = [/sk-[A-Za-z0-9_-]{20,}/, /hf_[A-Za-z0-9]{20,}/, /AIza[0-9A-Za-z_-]{30,}/, /xoxb-[A-Za-z0-9-]+/, /ghp_[A-Za-z0-9]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/]

// Claude Code names a project's session folder after its path with every non-alphanumeric character as a dash.
const cwd = process.cwd()
const projectSlug = cwd.replace(/[^A-Za-z0-9]/g, '-')
// The working directory in every spelling a tool might quote, longest first so the home form does not win early.
const cwdForms = [cwd, cwd.replace(/\\/g, '/'), cwd.replace(/\\/g, '\\\\'), '/' + cwd[0]!.toLowerCase() + cwd.slice(2).replace(/\\/g, '/'), '/c' + cwd.slice(2).replace(/\\/g, '/')]
const cwdRelative = cwd.slice(home.length).replace(/^[\\/]+/, '')
const cwdRelativeForms = [cwdRelative, cwdRelative.replace(/\\/g, '/'), cwdRelative.replace(/\\/g, '\\\\')]

// Repository slugs a host tool may report in a git-state block: the current origin and the private predecessor.
const REPO_SLUGS = ['olaservo/groups-positioning-demo', 'olaservo/mcp-progressive-disclosure-evals']

function scrub(text: string): string {
  let s = text
  for (const slug of REPO_SLUGS) s = s.split(slug).join('<repo>')
  for (const form of cwdForms) s = s.split(form).join('<project>')
  for (const form of homeForms) s = s.split(form).join('<home>')
  for (const form of cwdRelativeForms) s = s.split('<home>/' + form).join('<project>').split('<home>\\\\' + form).join('<project>').split('<home>\\' + form).join('<project>')
  s = s.split(projectSlug).join('<project>')
  // Session-specific temp paths a host tool may quote (AppData\Local\Temp\claude\<id>\...).
  return s.replace(/(<home>|[A-Za-z]:)(\\\\|\\|\/)+AppData(\\\\|\\|\/)+Local(\\\\|\\|\/)+Temp(\\\\|\\|\/)+claude(\\\\|\\|\/)+[^"\\\s]+/g, '<temp>')
}

function redactFile(from: string, to: string): { kept: number; dropped: number } {
  const lines = readFileSync(from, 'utf8').split('\n').filter(Boolean)
  let dropped = 0
  const kept: string[] = []
  for (const line of lines) {
    let row: Record<string, unknown>
    try { row = JSON.parse(line) as Record<string, unknown> } catch { dropped++; continue }
    if (!KEEP_TYPES.has(String(row.type))) { dropped++; continue }
    for (const field of DROP_FIELDS) delete row[field]
    const message = row.message as Record<string, unknown> | undefined
    if (message) for (const field of DROP_MESSAGE_FIELDS) delete message[field]
    const text = scrub(JSON.stringify(row))
    const hit = KEY_SHAPES.find((re) => re.test(text))
    if (hit) throw new Error(`${from}: a key-shaped string (${hit}) survives redaction; not writing`)
    kept.push(text)
  }
  mkdirSync(resolve(to, '..'), { recursive: true })
  writeFileSync(to, kept.join('\n') + '\n')
  return { kept: kept.length, dropped }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.jsonl') && name !== 'index.jsonl' ? [p] : []
  })
}

if (!existsSync(src)) throw new Error(`no such run: ${src}`)
let files = 0
let keptRows = 0
let droppedRows = 0
for (const file of walk(src)) {
  const rel = relative(src, file)
  // A session's group-open log (the mod's GROUPS_LOG) holds group names, counts and the server URL: scrubbed and copied whole.
  if (file.endsWith('.groups.jsonl')) {
    mkdirSync(resolve(join(out, rel), '..'), { recursive: true })
    writeFileSync(join(out, rel), scrub(readFileSync(file, 'utf8')))
    continue
  }
  const { kept, dropped } = redactFile(file, join(out, rel))
  files++
  keptRows += kept
  droppedRows += dropped
}
// The index, scrubbed the same way, with the per-run answers kept.
const index = join(src, 'index.jsonl')
if (existsSync(index)) {
  const rows = readFileSync(index, 'utf8').split('\n').filter(Boolean).map((l) => {
    const row = JSON.parse(l) as Record<string, unknown>
    delete row.stderr
    if (typeof row.file === 'string') row.file = relative(src, row.file).replace(/\\/g, '/')
    if (typeof row.groupsLog === 'string') row.groupsLog = relative(src, row.groupsLog).replace(/\\/g, '/')
    return scrub(JSON.stringify(row))
  })
  writeFileSync(join(out, 'index.jsonl'), rows.join('\n') + '\n')
}
console.log(`${files} session files -> ${out}; kept ${keptRows} conversation rows, dropped ${droppedRows} other rows`)
