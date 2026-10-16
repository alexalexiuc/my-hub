#!/usr/bin/env node
/**
 * Print the exported symbols of TypeScript files, one line per file — a live replacement for
 * hand-maintained "inventory" docs. Agents run it before writing a helper or a query, so they reuse
 * what already exists.
 *
 * Usage:
 *   pnpm -s inventory                                   # shared utils + services (default)
 *   pnpm -s inventory packages/shared/src/services/finances
 *   pnpm -s inventory packages/hub/src/components --docs   # also print each export's JSDoc summary
 *
 * Test files, stories, barrels (index.ts) and `.d.ts` files are skipped.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const withDocs = args.includes('--docs');
const targets = args.filter(a => !a.startsWith('--'));
const roots = targets.length ? targets : ['packages/shared/src/utils', 'packages/shared/src/services'];

const SKIP = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$|(^|\/)index\.ts$)/;
const EXPORT_RE =
  /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function\*?|const|let|class|interface|type|enum|abstract\s+class)\s+([A-Za-z0-9_$]+)/;

function walk(p) {
  const abs = path.resolve(REPO_ROOT, p);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(abs, d.name)) : /\.tsx?$/.test(d.name) ? [path.join(abs, d.name)] : [],
  );
}

/** First sentence of the JSDoc block that ends right above line `i`, or ''. */
function jsdocSummary(lines, i) {
  let j = i - 1;
  if (j < 0 || !lines[j].trim().endsWith('*/')) return '';
  const block = [];
  while (j >= 0 && !lines[j].includes('/**')) block.unshift(lines[j--]);
  if (j >= 0) block.unshift(lines[j]);
  const text = block
    .join(' ')
    .replace(/\/\*\*|\*\/|^\s*\*|\s\*\s/gm, ' ')
    .replace(/@\w+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = text.split(/(?<=[.;])\s/)[0] ?? '';
  return sentence.length > 110 ? `${sentence.slice(0, 107)}...` : sentence;
}

const kindTag = { interface: 'T', type: 'T', enum: 'T', class: 'C', 'abstract class': 'C' };

for (const root of roots) {
  for (const file of walk(root).sort()) {
    const rel = path.relative(REPO_ROOT, file);
    if (SKIP.test(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    const items = [];
    lines.forEach((line, i) => {
      const m = EXPORT_RE.exec(line);
      if (!m) return;
      const tag = kindTag[m[1]] ? `${m[2]}:${kindTag[m[1]]}` : m[2];
      items.push(withDocs ? { tag, doc: jsdocSummary(lines, i) } : { tag });
    });
    if (!items.length) continue;
    if (withDocs) {
      console.log(rel);
      for (const { tag, doc } of items) console.log(`  ${tag}${doc ? ` — ${doc}` : ''}`);
    } else {
      console.log(`${rel}: ${items.map(x => x.tag).join(', ')}`);
    }
  }
}
