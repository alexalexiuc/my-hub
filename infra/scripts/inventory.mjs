#!/usr/bin/env node
/**
 * Print the exported symbols of TypeScript files, one line per file — a live replacement for
 * hand-maintained "inventory" docs. Agents run it before writing a helper or a query, so they reuse
 * what already exists. Also imported by the Claude Code hooks (`.claude/hooks/`) that keep agents from
 * re-creating shared helpers.
 *
 * Usage:
 *   pnpm inventory                                      # shared utils + services (default)
 *   pnpm inventory packages/shared/src/services/finances
 *   pnpm inventory packages/hub/src/components --docs   # also print each export's JSDoc summary
 *   pnpm inventory packages/shared/src/utils --brief    # values only (no types), paths relative to the root
 *
 * Test files, stories, barrels (index.ts) and `.d.ts` files are skipped.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SKIP = /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$|(^|\/)index\.ts$)/;
const EXPORT_RE =
  /^export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(function\*?|const|let|class|interface|type|enum|abstract\s+class)\s+([A-Za-z0-9_$]+)(.*)$/;
const TYPE_KINDS = new Set(['interface', 'type', 'enum']);

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

/** Parameter list as written on the declaration line, e.g. `(dateStr: string, n: number)`, or ''. */
function paramsOf(kind, rest) {
  const src = kind.startsWith('function') ? rest : (/^\s*(?::[^=]+)?=\s*(?:async\s*)?(.*)$/.exec(rest)?.[1] ?? '');
  const start = /^\s*(?:<[^>]*>)?\s*\(/.exec(src);
  if (!start) return '';
  // Balanced scan, so defaults like `d: Date = new Date()` stay inside the list.
  let depth = 0;
  for (let i = start[0].length - 1; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(start[0].length - 1, i + 1);
  }
  return '';
}

/**
 * Collect the exports of every TypeScript file under `roots` (repo-relative paths).
 * @returns {{ file: string, items: { name: string, kind: string, isType: boolean, params: string, doc: string }[] }[]}
 */
export function collectExports(roots) {
  const result = [];
  for (const root of roots) {
    for (const file of walk(root).sort()) {
      const rel = path.relative(REPO_ROOT, file);
      if (SKIP.test(rel)) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      const items = [];
      lines.forEach((line, i) => {
        const m = EXPORT_RE.exec(line);
        if (!m) return;
        const kind = m[1].replace(/\s+/g, ' ');
        items.push({
          name: m[2],
          kind,
          isType: TYPE_KINDS.has(kind),
          params: paramsOf(kind, m[3] ?? ''),
          doc: jsdocSummary(lines, i),
        });
      });
      if (items.length) result.push({ file: rel, items });
    }
  }
  return result;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = process.argv.slice(2);
  const withDocs = args.includes('--docs');
  const brief = args.includes('--brief');
  const targets = args.filter(a => !a.startsWith('--'));
  const roots = targets.length ? targets : ['packages/shared/src/utils', 'packages/shared/src/services'];
  const tag = it => (it.isType ? `${it.name}:T` : it.kind.includes('class') ? `${it.name}:C` : it.name);

  for (const { file, items } of collectExports(roots)) {
    if (brief) {
      const values = items.filter(it => !it.isType).map(it => it.name);
      const shortFile = roots.length === 1 ? path.relative(roots[0], file) || path.basename(file) : file;
      if (values.length) console.log(`${shortFile}: ${values.join(', ')}`);
    } else if (withDocs) {
      console.log(file);
      for (const it of items) console.log(`  ${tag(it)}${it.doc ? ` — ${it.doc}` : ''}`);
    } else {
      console.log(`${file}: ${items.map(tag).join(', ')}`);
    }
  }
}
