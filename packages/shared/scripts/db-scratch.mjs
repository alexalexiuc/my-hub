// Throwaway database next to the dev one, for checking services or migrations against real PostgreSQL
// without touching dev data. Uses the server/credentials from the root .env DATABASE_URL.
//
//   pnpm db:scratch create            # (re)create it and apply all migrations
//   pnpm db:scratch exec -- <cmd...>  # run a command with DATABASE_URL pointing at it (from your cwd)
//   pnpm db:scratch drop              # drop it
//
// SCRATCH_DB_NAME overrides the database name (default myhub_scratch).
import 'dotenv-mono/load';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const SHARED_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const name = process.env.SCRATCH_DB_NAME ?? 'myhub_scratch';
if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`SCRATCH_DB_NAME must be [a-z0-9_]+, got "${name}"`);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (root .env).');

const devUrl = new URL(process.env.DATABASE_URL);
if (devUrl.pathname.slice(1) === name) throw new Error(`Refusing: "${name}" is the dev database itself.`);
const scratchUrl = new URL(devUrl);
scratchUrl.pathname = `/${name}`;

const run = (cmd, args, cwd) => {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: scratchUrl.toString() },
  });
  return res.status ?? 1;
};

async function admin(sql) {
  const client = postgres(devUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(sql);
  } finally {
    await client.end();
  }
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case 'create': {
    await admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin(`CREATE DATABASE ${name}`);
    console.error(`▸ Created ${name}; applying migrations`);
    process.exit(run('pnpm', ['exec', 'drizzle-kit', 'migrate'], SHARED_DIR));
    break;
  }
  case 'drop': {
    await admin(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    console.error(`▸ Dropped ${name}`);
    break;
  }
  case 'exec': {
    const args = rest[0] === '--' ? rest.slice(1) : rest;
    if (args.length === 0) throw new Error('Usage: pnpm db:scratch exec -- <command> [args...]');
    process.exit(run(args[0], args.slice(1), process.env.INIT_CWD ?? process.cwd()));
    break;
  }
  default:
    console.error('Usage: pnpm db:scratch <create|exec -- <cmd...>|drop>');
    process.exit(1);
}
