#!/usr/bin/env node
import 'dotenv-mono/load';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

function readOption(name, defaultValue = undefined) {
  const key = `--${name}`;
  const idx = args.indexOf(key);
  if (idx === -1) {
    return defaultValue;
  }

  const value = args[idx + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${key}`);
  }
  return value;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function sanitizeSingleQuotes(input) {
  return input.replace(/'/g, "'\"'\"'");
}

function usage() {
  console.log(`
Usage:
  node infra/scripts/server-compose-logs.mjs [options]

Options:
  --env <prod|staging>   Stack environment (default: prod)
  --service <name>       Optional compose service name
  --tail <number>        Number of lines to show (default: 200)
  --follow               Follow logs stream
  --since <duration>     Show logs since duration (e.g. 10m, 1h)
  --host <hostname>      SSH host (default: VPS_HOST env var)
  --user <username>      SSH user (default: VPS_USER env var)
  --repo-path <path>     Remote repo path (default: /opt/my-hub)
  --help                 Show this help

Examples:
  pnpm logs:server:prod -- --service mcp --tail 100
  pnpm logs:server:staging -- --service hub --follow
`);
}

if (hasFlag('help')) {
  usage();
  process.exit(0);
}

const envName = readOption('env', 'prod');
const service = readOption('service');
const tail = readOption('tail', '200');
const since = readOption('since');
const host = readOption('host', process.env['VPS_HOST']);
const user = readOption('user', process.env['VPS_USER']);
const repoPath = readOption('repo-path', '/opt/my-hub');
const follow = hasFlag('follow');

if (!host) {
  console.error('Missing SSH host. Set VPS_HOST or pass --host <hostname>.');
  process.exit(1);
}

if (!user) {
  console.error('Missing SSH user. Set VPS_USER or pass --user <username>.');
  process.exit(1);
}

if (!/^\d+$/.test(tail)) {
  console.error('Invalid --tail value. Use a positive integer.');
  process.exit(1);
}

let composeArgs;
if (envName === 'prod') {
  composeArgs = ['--env-file', '.env', '-f', 'infra/docker-compose.prod.yml'];
} else if (envName === 'staging') {
  composeArgs = [
    '--project-name',
    'my-hub-staging',
    '--env-file',
    '.env.staging',
    '-f',
    'infra/docker-compose.staging.yml',
  ];
} else {
  console.error('Invalid --env value. Use "prod" or "staging".');
  process.exit(1);
}

const logArgs = ['logs', `--tail=${tail}`];
if (follow) {
  logArgs.push('--follow');
}
if (since) {
  logArgs.push(`--since=${since}`);
}
if (service) {
  logArgs.push(service);
}

const remoteCommand = [
  `cd '${sanitizeSingleQuotes(repoPath)}'`,
  ['docker compose', ...composeArgs, ...logArgs].join(' '),
].join('; ');

const sshTarget = `${user}@${host}`;
const child = spawn('ssh', [sshTarget, remoteCommand], {
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`Failed to run ssh: ${error.message}`);
  process.exit(1);
});
