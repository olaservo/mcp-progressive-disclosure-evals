// Deploys every variant as its own Worker. A shell loop in package.json fails under cmd on Windows.
import { execFileSync } from 'node:child_process'

for (const env of ['flat', 'opt1', 'opt2', 'opt3']) {
  execFileSync('npx', ['wrangler', 'deploy', '--env', env], { stdio: 'inherit', shell: true })
}
