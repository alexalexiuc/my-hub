#!/usr/bin/env node
/**
 * Run E2E tests against the staging environment.
 *
 * Usage:
 *   node infra/scripts/e2e-staging.mjs [options]
 *   pnpm test:e2e:staging
 *
 * What it does:
 *   1. SSHs into VPS and deploys the staging Docker stack (unless --skip-deploy)
 *   2. Registers the E2E hub user so seeds can find them
 *   3. Runs E2E seeds on the server via docker compose run
 *   4. Provisions MCP OAuth credentials on the server
 *   5. Runs `pnpm test:e2e` locally pointing at staging URLs
 *   6. Tears down the staging stack (unless --keep-alive)
 */

import 'dotenv-mono/load';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function readOption(name, defaultValue = undefined) {
  const key = `--${name}`;
  const idx = args.indexOf(key);
  if (idx === -1) return defaultValue;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
  return value;
}

if (hasFlag('help')) {
  console.log(`
Usage:
  node infra/scripts/e2e-staging.mjs [options]

Options:
  --skip-deploy    Skip deploying / updating the staging stack (use already-running staging)
  --keep-alive     Do not tear down staging after tests finish
  --host <host>    SSH host (default: VPS_HOST env var)
  --user <user>    SSH user (default: VPS_USER env var)
  --help           Show this help

Environment variables read from .env:
  VPS_HOST, VPS_USER
  E2E_HUB_USER_EMAIL, E2E_HUB_USER_PASSWORD
  E2E_MCP_CLIENT_ID, E2E_MCP_CLIENT_SECRET, E2E_MCP_USER_EMAIL
`);
  process.exit(0);
}

const skipDeploy = hasFlag('skip-deploy');
const keepAlive = hasFlag('keep-alive');
const host = readOption('host', process.env['VPS_HOST']);
const user = readOption('user', process.env['VPS_USER']);

const hubUserEmail = process.env['E2E_HUB_USER_EMAIL'];
const hubUserPassword = process.env['E2E_HUB_USER_PASSWORD'];
const mcpClientId = process.env['E2E_MCP_CLIENT_ID'];
const mcpClientSecret = process.env['E2E_MCP_CLIENT_SECRET'];
const mcpUserEmail = process.env['E2E_MCP_USER_EMAIL'];

// ── Validate ─────────────────────────────────────────────────────────────────

const missing = [];
if (!host) missing.push('VPS_HOST (or --host)');
if (!user) missing.push('VPS_USER (or --user)');
if (!hubUserEmail) missing.push('E2E_HUB_USER_EMAIL');
if (!hubUserPassword) missing.push('E2E_HUB_USER_PASSWORD');
if (!mcpClientId) missing.push('E2E_MCP_CLIENT_ID');
if (!mcpClientSecret) missing.push('E2E_MCP_CLIENT_SECRET');
if (missing.length) {
  console.error('Missing required config:\n' + missing.map((m) => `  - ${m}`).join('\n'));
  process.exit(1);
}

const sshTarget = `${user}@${host}`;
const STAGING_HUB_URL = 'https://staging.hub.alexiuc.dev';
const STAGING_MCP_URL = 'https://staging.mcp.alexiuc.dev';
const REPO_PATH = '/opt/my-hub';
const COMPOSE_FILE = 'infra/docker-compose.staging.yml';
const ENV_FILE = '.env.staging';
const PROJECT_NAME = 'my-hub-staging';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ssh(script, { label, env: extraEnv = {} } = {}) {
  if (label) console.log(`\n▶ ${label}`);

  const envExports = Object.entries(extraEnv)
    .map(([k, v]) => `export ${k}=${JSON.stringify(v)}`)
    .join('\n');

  const fullScript = [envExports, 'set -e', `cd ${REPO_PATH}`, script].filter(Boolean).join('\n');

  const result = spawnSync('ssh', [sshTarget, fullScript], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`SSH command failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

function runLocal(cmd, args, { label, env: extraEnv = {} } = {}) {
  if (label) console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  WARNING: tests run against the last PUSHED image on GHCR,      ║
║  not your local code. Uncommitted or unpushed changes will NOT   ║
║  be reflected. Push your branch and wait for the build job to    ║
║  finish before running this script.                              ║
╚══════════════════════════════════════════════════════════════════╝
`);

// eslint-disable-next-line no-useless-assignment
let testsExitCode = 0;

try {
  // 1. Deploy staging stack
  if (!skipDeploy) {
    ssh(
      `docker compose --project-name my-hub-traefik -f infra/docker-compose.traefik.yml up -d
docker compose --project-name ${PROJECT_NAME} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} pull
docker compose --project-name ${PROJECT_NAME} --env-file ${ENV_FILE} -f ${COMPOSE_FILE} up -d --wait`,
      { label: 'Deploying staging stack' },
    );
  } else {
    console.log('\n⏭  Skipping deploy (--skip-deploy)');
  }

  // 2. Provision MCP OAuth credentials
  ssh(
    `docker compose --project-name ${PROJECT_NAME} --env-file ${ENV_FILE} \\
  -f ${COMPOSE_FILE} exec -T \\
  -e E2E_MCP_CLIENT_ID=${JSON.stringify(mcpClientId)} \\
  -e E2E_MCP_CLIENT_SECRET=${JSON.stringify(mcpClientSecret)} \\
  -e E2E_HUB_USER_EMAIL=${JSON.stringify(hubUserEmail)} \\
  mcp node /app/dist/e2e-setup.js`,
    { label: 'Provisioning MCP OAuth credentials' },
  );

  // 3. Run tests locally pointing at staging
  console.log('\n▶ Running E2E tests against staging');
  console.log(`   Hub:  ${STAGING_HUB_URL}`);
  console.log(`   MCP:  ${STAGING_MCP_URL}`);

  testsExitCode = runLocal('pnpm', ['test:e2e'], {
    env: {
      E2E_HUB_BASE_URL: STAGING_HUB_URL,
      E2E_HUB_USER_EMAIL: hubUserEmail,
      E2E_HUB_USER_PASSWORD: hubUserPassword,
      E2E_MCP_BASE_URL: STAGING_MCP_URL,
      NEXT_PUBLIC_MCP_URL: STAGING_MCP_URL,
      E2E_MCP_USER_EMAIL: mcpUserEmail ?? '',
      E2E_MCP_CLIENT_ID: mcpClientId,
      E2E_MCP_CLIENT_SECRET: mcpClientSecret,
      IS_LOCAL: 'false',
    },
  });
} finally {
  // 4. Tear down staging
  if (!keepAlive) {
    ssh(
      `docker compose --project-name ${PROJECT_NAME} --env-file ${ENV_FILE} \\
  -f ${COMPOSE_FILE} down -v
docker image prune -f`,
      { label: 'Tearing down staging stack' },
    );
  } else {
    console.log('\n⏭  Keeping staging alive (--keep-alive)');
  }
}

process.exit(testsExitCode);
