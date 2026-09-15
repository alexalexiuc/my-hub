#!/usr/bin/env node
/**
 * Bring up a throwaway Hub instance with demo data, for eyeballing the UI.
 *
 * Usage:
 *   pnpm ui:sandbox              # migrate + seed + start the hub on :3000
 *   pnpm ui:sandbox --skip-seed  # reuse whatever is already in the sandbox DB
 *   pnpm ui:sandbox --seed-only  # migrate + seed, then exit (no dev server)
 *   pnpm ui:sandbox --port 3100
 *
 * Built for a disposable environment (a CI box, a fresh container, a Claude Code session): it
 * targets its own database, fills it with demo fixtures, and prints sign-in credentials. It is
 * NOT a dev-environment replacement — for day-to-day work use `pnpm dev:hub` against your own DB.
 *
 * What it does:
 *   1. Starts a local PostgreSQL if one is installed but not running (best effort).
 *   2. Creates the sandbox role/database if they do not exist.
 *   3. Runs Drizzle migrations against it.
 *   4. Seeds demo fixtures via packages/e2e/scripts/setup-sandbox-db.ts.
 *   5. Starts `next dev` with placeholder secrets and waits for it to answer.
 */

import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const args = process.argv.slice(2);
const hasFlag = name => args.includes(`--${name}`);
const readOption = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
  return value;
};

if (hasFlag('help')) {
  console.log(
    [
      'Usage: pnpm ui:sandbox [options]',
      '',
      '  --port <n>     Port for the hub dev server (default 3000)',
      '  --months <n>   Months of demo history to seed (default 21)',
      '  --skip-seed    Skip migrate + seed, just start the hub',
      '  --seed-only    Migrate + seed, then exit',
      '  --help         Show this message',
    ].join('\n'),
  );
  process.exit(0);
}

const PORT = readOption('port', '3000');
const MONTHS = readOption('months', '21');

const PG_HOST = process.env.SANDBOX_PGHOST ?? '127.0.0.1';
const PG_PORT = process.env.SANDBOX_PGPORT ?? '5432';
const PG_USER = process.env.SANDBOX_PGUSER ?? 'myhub';
const PG_PASSWORD = process.env.SANDBOX_PGPASSWORD ?? 'myhub';
const PG_DB = process.env.SANDBOX_PGDATABASE ?? 'myhub_sandbox';
const DATABASE_URL =
  process.env.SANDBOX_DATABASE_URL ?? `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}`;

/**
 * Placeholder secrets. Every value here is fake and only has to satisfy `getEnvVar`'s fail-fast
 * check — the sandbox never talks to Google, SES or any other third party.
 */
const SANDBOX_ENV = {
  DATABASE_URL,
  NEXTAUTH_SECRET: 'sandbox-secret-not-for-real-use',
  NEXTAUTH_URL: `http://localhost:${PORT}`,
  HUB_URL: `http://localhost:${PORT}`,
  GOOGLE_CLIENT_ID: 'sandbox-placeholder',
  GOOGLE_CLIENT_SECRET: 'sandbox-placeholder',
  ENCRYPTION_KEY: 'sandbox-placeholder-32-chars-min__',
  AWS_REGION: 'us-east-1',
  SES_FROM_EMAIL: 'noreply@sandbox.local',
  UNSUBSCRIBE_SECRET: 'sandbox-placeholder',
  EMAIL_VERIFICATION_SECRET: 'sandbox-placeholder',
  E2E_TEST_EMAILS: '',
  NEXT_TELEMETRY_DISABLED: '1',
};

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: options.quiet ? 'pipe' : 'inherit',
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...SANDBOX_ENV, ...(options.env ?? {}) },
    encoding: 'utf8',
  });
  if (!options.allowFailure && result.status !== 0) {
    if (options.quiet) console.error(result.stderr ?? '');
    throw new Error(`${command} ${commandArgs.join(' ')} exited with ${result.status}`);
  }
  return result;
}

function postgresIsUp() {
  const probe = run('pg_isready', ['-h', PG_HOST, '-p', PG_PORT], { quiet: true, allowFailure: true });
  return probe.status === 0;
}

function ensurePostgres() {
  if (postgresIsUp()) return;

  console.log('▸ PostgreSQL is not answering — trying to start a local server...');
  // Debian/Ubuntu images (including the Claude Code container) ship postgres behind `service`.
  run('service', ['postgresql', 'start'], { allowFailure: true, quiet: true });

  for (let attempt = 0; attempt < 10; attempt++) {
    if (postgresIsUp()) return;
    spawnSync('sleep', ['1']);
  }

  throw new Error(
    `No PostgreSQL at ${PG_HOST}:${PG_PORT}. Start one yourself (or point SANDBOX_DATABASE_URL at an existing database) and re-run.`,
  );
}

function ensureDatabase() {
  const psqlAsSuperuser = sql =>
    run('su', ['postgres', '-c', `psql -tAc ${JSON.stringify(sql)}`], { quiet: true, allowFailure: true });

  const roleExists = psqlAsSuperuser(`SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'`);
  if (roleExists.status === 0 && !roleExists.stdout.trim()) {
    console.log(`▸ Creating role ${PG_USER}`);
    psqlAsSuperuser(`CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}' SUPERUSER`);
  }

  const dbExists = psqlAsSuperuser(`SELECT 1 FROM pg_database WHERE datname='${PG_DB}'`);
  if (dbExists.status === 0 && !dbExists.stdout.trim()) {
    console.log(`▸ Creating database ${PG_DB}`);
    run('su', ['postgres', '-c', `createdb -O ${PG_USER} ${PG_DB}`], { quiet: true, allowFailure: true });
  }
}

function migrateAndSeed() {
  console.log('▸ Building @my-hub/shared');
  run('pnpm', ['--filter', 'shared', 'build'], { quiet: true });

  console.log('▸ Running migrations');
  const migrated = run('pnpm', ['--filter', 'shared', 'db:migrate'], { quiet: true, allowFailure: true });
  if (migrated.status !== 0) {
    console.error(migrated.stderr ?? migrated.stdout ?? '');
    throw new Error(
      `Migrations failed against ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}. ` +
        'Check the database exists and the credentials are right, or set SANDBOX_DATABASE_URL.',
    );
  }

  console.log('▸ Seeding demo data');
  run('pnpm', ['exec', 'tsx', 'scripts/setup-sandbox-db.ts'], {
    cwd: path.join(REPO_ROOT, 'packages/e2e'),
    env: { SANDBOX_MONTHS: MONTHS },
  });
}

async function startHub() {
  console.log(`▸ Starting the hub on http://localhost:${PORT}`);
  const hub = spawn('pnpm', ['exec', 'next', 'dev', '-p', PORT], {
    cwd: path.join(REPO_ROOT, 'packages/hub'),
    env: { ...process.env, ...SANDBOX_ENV },
    stdio: 'inherit',
  });

  const stop = () => hub.kill('SIGTERM');
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // Poll until the sign-in page answers, so the caller knows when it is safe to drive the UI.
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      const res = await fetch(`http://localhost:${PORT}/auth/signin`);
      if (res.ok) break;
    } catch {
      // not up yet
    }
  }

  console.log(
    [
      '',
      '  Sandbox ready',
      `  URL      http://localhost:${PORT}`,
      '  Email    sandbox@test.local',
      '  Password SandboxPass123!',
      '',
      '  Ctrl-C to stop.',
      '',
    ].join('\n'),
  );

  hub.on('exit', code => process.exit(code ?? 0));
}

ensurePostgres();
ensureDatabase();
if (!hasFlag('skip-seed')) migrateAndSeed();
if (hasFlag('seed-only')) {
  console.log('▸ Seed complete (--seed-only)');
  process.exit(0);
}
await startHub();
