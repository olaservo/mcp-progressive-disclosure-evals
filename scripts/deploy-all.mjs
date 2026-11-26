// Deploys the variants the trials use, each as its own Worker. opt1 and opt3 run locally for the token comparison.
// A shell loop in package.json fails under cmd on Windows.
import { execFileSync } from 'node:child_process'

// --full vendors the 3,036-tool catalog, deploys the three -full Workers, and vendors the subset back.
const full = process.argv.includes('--full')
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit', shell: true })

if (full) run('npm', ['run', 'vendor:full'])
try {
  for (const env of ['flat', 'opt2', 'opt2-rec']) run('npx', ['wrangler', 'deploy', '--env', full ? `${env}-full` : env])
} finally {
  if (full) run('npm', ['run', 'vendor'])
}
