// Deploys the variants the trials use, each as its own Worker. opt1 and opt3 run locally for the token comparison.
// A shell loop in package.json fails under cmd on Windows.
import { execFileSync } from 'node:child_process'

for (const env of ['flat', 'opt2', 'opt2-rec']) {
  execFileSync('npx', ['wrangler', 'deploy', '--env', env], { stdio: 'inherit', shell: true })
}
