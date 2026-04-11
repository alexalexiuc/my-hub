import 'dotenv-mono/load';
import { execSync } from 'child_process';

async function setup() {
  void (() => {
    console.log('Running global e2e setup...');
    if (process.env['IS_LOCAL'] === 'true') {
      console.error('Running local e2e setup...');
      execSync('npx tsx scripts/setup-e2e-db.ts', {
        cwd: __dirname,
        stdio: 'inherit',
        env: process.env,
      });
    }
  })();
}

export default setup;
