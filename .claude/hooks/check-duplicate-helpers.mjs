#!/usr/bin/env node
/**
 * PostToolUse hook (Write | Edit | MultiEdit): when an edit to a .ts/.tsx file defines a function whose name
 * matches — exactly or nearly (`shiftDayStr` vs `shiftDateStr`, `toDateStr` vs `dateToString`, `fmtX` vs
 * `formatX`) — a helper that already exists in @my-hub/shared/utils (or, for hub files, @/lib/utils and @/hooks),
 * it tells the agent which helper to reuse. It never blocks the edit and stays silent on any error.
 *
 * Test it by hand:
 *   echo '{"tool_name":"Write","tool_input":{"file_path":"packages/hub/src/x.ts","content":"function shiftDayStr() {}"}}' \
 *     | node .claude/hooks/check-duplicate-helpers.mjs
 */
import path from 'node:path';
import { collectExports, REPO_ROOT } from '../../infra/scripts/inventory.mjs';

const SHARED_UTILS = 'packages/shared/src/utils';
const HUB_HELPERS = ['packages/hub/src/lib/utils', 'packages/hub/src/hooks'];
const SKIP_FILE =
  /(\.test\.|\.spec\.|\.stories\.|\.d\.ts$|\/node_modules\/|^\.claude\/|^packages\/shared\/src\/utils\/)/;

// Function definitions: `function name(`, `const name = (…) =>`, `const name = async (`, `const name = <T>(`,
// `const name = function`. Components (PascalCase) are not helpers.
const DEF_RE =
  /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*([a-z][A-Za-z0-9_$]*)\s*[<(]|(?:const|let)\s+([a-z][A-Za-z0-9_$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:function\b|<[^>\n]*>\s*\(|\([^)\n]*\)\s*(?::[^=\n]+)?=>|[a-z_$][\w$]*\s*=>))/g;

const ALIASES = { fmt: 'format', num: 'number', str: '', string: '', day: 'date', dt: 'date' };
const STOP = new Set(['to', 'get', 'as', 'of', '']);

function definedNames(text) {
  const names = new Set();
  for (const m of text.matchAll(DEF_RE)) names.add(m[1] ?? m[2]);
  return names;
}

/** camelCase words, aliased and without filler, as a sorted key — `shiftDayStr` and `shiftDateStr` share one. */
function nameKey(name) {
  const raw = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_]+/);
  const words = raw.map(w => ALIASES[w] ?? w).filter(w => !STOP.has(w));
  return { key: [...new Set(words)].sort().join(' '), rawCount: raw.length, size: new Set(words).size };
}

function newText(toolName, input) {
  if (toolName === 'Write') return { added: input.content ?? '', removed: '' };
  if (toolName === 'Edit') return { added: input.new_string ?? '', removed: input.old_string ?? '' };
  if (toolName === 'MultiEdit') {
    const edits = input.edits ?? [];
    return {
      added: edits.map(e => e.new_string ?? '').join('\n'),
      removed: edits.map(e => e.old_string ?? '').join('\n'),
    };
  }
  return { added: '', removed: '' };
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const { tool_name: toolName, tool_input: input = {} } = JSON.parse(raw || '{}');
  const filePath = input.file_path;
  if (!filePath || !/\.(ts|tsx|mts)$/.test(filePath)) return;
  const rel = path.relative(REPO_ROOT, path.resolve(REPO_ROOT, filePath));
  if (rel.startsWith('..') || SKIP_FILE.test(rel)) return;

  const { added, removed } = newText(toolName, input);
  const before = definedNames(removed);
  const fresh = [...definedNames(added)].filter(n => !before.has(n));
  if (!fresh.length) return;

  const roots = rel.startsWith('packages/hub/') ? [SHARED_UTILS, ...HUB_HELPERS] : [SHARED_UTILS];
  const catalog = collectExports(roots).flatMap(({ file, items }) =>
    file === rel ? [] : items.filter(it => !it.isType).map(it => ({ ...it, file, ...nameKey(it.name) })),
  );

  const notes = [];
  for (const name of fresh) {
    const mine = nameKey(name);
    const close = mine.size >= 2 || mine.rawCount >= 2;
    const hit =
      catalog.find(c => c.name === name) ??
      (close ? catalog.find(c => c.key === mine.key && (c.size >= 2 || c.rawCount >= 2)) : undefined);
    if (!hit) continue;
    const from = hit.file.startsWith(SHARED_UTILS)
      ? `@my-hub/shared/utils (${path.relative(SHARED_UTILS, hit.file)})`
      : hit.file.startsWith('packages/hub/src/lib/utils/')
        ? '@/lib/utils'
        : `@/${hit.file.replace('packages/hub/src/', '').replace(/\.tsx?$/, '')}`;
    const how = hit.name === name ? 'has the same name as' : 'looks like';
    notes.push(`- \`${name}\` ${how} \`${hit.name}${hit.params}\` from ${from}${hit.doc ? ` — ${hit.doc}` : ''}`);
  }
  if (!notes.length) return;

  const additionalContext = [
    `Possible duplicate helper(s) in ${rel}:`,
    ...notes,
    'Reuse the existing helper and delete the local one. If the behaviour really must differ, give the new function a',
    'name that says how (same-named helpers with different semantics cause silent bugs). A general-purpose helper',
    'that is still missing belongs in packages/shared/src/utils/.',
  ].join('\n');
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } }));
}

main().catch(() => {});
