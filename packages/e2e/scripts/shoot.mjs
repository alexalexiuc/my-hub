#!/usr/bin/env node
/**
 * Screenshot Hub pages against a running instance (usually `pnpm ui:sandbox`), signed in, at phone and
 * desktop widths, and report every console error / page error seen while loading them.
 *
 * Usage (from packages/e2e, so `@playwright/test` resolves):
 *   node scripts/shoot.mjs /finances /vacation
 *   node scripts/shoot.mjs /travel --widths 390 --out /tmp/shots --base http://localhost:3100
 *   node scripts/shoot.mjs /calories --full --wait 'text=Today'      # full-page, wait for a selector
 *
 * Options:
 *   --base <url>      Hub origin (default http://localhost:3000)
 *   --out <dir>       Output directory (default: $SHOTS_DIR, else <os tmpdir>/my-hub-shots)
 *   --widths <list>   Comma-separated viewport widths (default 390,1280)
 *   --wait <sel>      Extra Playwright selector to wait for on every page
 *   --full            Full-page screenshots
 *   --email/--password  Credentials (default: the sandbox user)
 *
 * Prints one line per screenshot, then the collected errors (the aborted next-auth session fetch that fires
 * when navigating away is filtered out). Exit code 1 if any other error was seen.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = name => argv.includes(`--${name}`);
const valued = new Set(['base', 'out', 'widths', 'wait', 'email', 'password']);
const paths = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]?.replace(/^--/, '')));

const BASE = opt('base', 'http://localhost:3000').replace(/\/$/, '');
const OUT = path.resolve(opt('out', process.env.SHOTS_DIR ?? path.join(tmpdir(), 'my-hub-shots')));
const WIDTHS = opt('widths', '390,1280').split(',').map(Number);
const WAIT = opt('wait', null);
const EMAIL = opt('email', 'sandbox@test.local');
const PASSWORD = opt('password', 'SandboxPass123!');

if (!paths.length) {
  console.error('Usage: node scripts/shoot.mjs <path> [<path>...] [--widths 390,1280] [--out dir]');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ executablePath });
const errors = [];
const IGNORED = /CLIENT_FETCH_ERROR|\/api\/auth\/session/;

try {
  for (const width of WIDTHS) {
    const mobile = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 1000 },
      ...(mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
    });
    const page = await context.newPage();
    page.on('console', m => m.type() === 'error' && !IGNORED.test(m.text()) && errors.push(`[${width}] ${m.text()}`));
    page.on('pageerror', e => errors.push(`[${width}] pageerror: ${e.message}`));

    await page.goto(`${BASE}/auth/signin`);
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`${BASE}/`);

    for (const p of paths) {
      await page.goto(`${BASE}${p}`);
      // Pages fetch their data client-side: wait for the network to settle, not just for `load`.
      await page.waitForLoadState('networkidle').catch(() => {});
      if (WAIT) await page.locator(WAIT).first().waitFor({ timeout: 15000 });
      const file = path.join(OUT, `${p.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'home'}-${width}.png`);
      await page.screenshot({ path: file, fullPage: flag('full') });
      console.log(`shot ${file}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.log(`\n${errors.length} console/page error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log('\nno console errors');
