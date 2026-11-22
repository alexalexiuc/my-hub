import { randomInt } from 'node:crypto';

/** Entry kinds the MCP tools accept. Hand-edited files may use others; the parser keeps them as-is. */
export const ENTRY_TYPES = ['fact', 'verdict', 'contact', 'price', 'how-to'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

const ENTRY_RE = /^- (\d{4}-\d{2}-\d{2}) \[([^\]\s]+)\] (.*?)(?: \^([a-z0-9]{2,16}))?\s*$/;
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;
const KEY_LINE_RE = /^([A-Za-z_][\w-]*):(?:\s*(.*))?$/;

/** One `- YYYY-MM-DD [type] text #tags ^id` line. `raw` is the exact original line. */
export interface EntryLine {
  kind: 'entry';
  raw: string;
  date: string;
  type: string;
  /** Text without the trailing `^id` (tags stay inside the text). */
  text: string;
  tags: string[];
  /** The `^id`, or null for hand-written lines that have none yet. */
  id: string | null;
}

/** Any other body line (description, blank line, comment, a malformed bullet...). Preserved verbatim. */
export interface TextLine {
  kind: 'text';
  raw: string;
}

export type BodyLine = EntryLine | TextLine;

export interface Frontmatter {
  title: string;
  category: string;
  tags: string[];
  aliases: string[];
  updated: string | null;
  /** False only when the file says `reviewed: false` (a note created by `remember` that no review pass has seen). */
  reviewed: boolean;
}

/**
 * A parsed note that keeps every original line, so `serializeNote(parseNote(x)) === x` byte for byte
 * and edits only touch the lines they change (unknown frontmatter keys, comments and spacing survive).
 */
export interface ParsedNote {
  /** Raw frontmatter lines between (not including) the `---` fences; empty when the file has none. */
  frontmatterLines: string[];
  hasFrontmatter: boolean;
  body: BodyLine[];
  /** True when the original text ended with a newline. */
  trailingNewline: boolean;
  /** Original line terminator, kept so CRLF files stay CRLF. */
  eol: '\n' | '\r\n';
}

/** A derived key for an entry: its `^id`, or a stable content hash key for lines that have none. */
export interface KeyedEntry extends EntryLine {
  key: string;
  /** Position of the line in `ParsedNote.body`, so identical lines can be told apart. */
  index: number;
}

/** Splits an inline `[a, "b, c", 'd']` list. Quoted items keep their escapes until `unquote` decodes them. */
function splitList(value: string): string[] {
  const inner = value.trim().replace(/^\[/, '').replace(/\]$/, '');
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    cur += ch;
    if (quote) {
      if (quote === '"' && ch === '\\' && i + 1 < inner.length) cur += inner[++i];
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ',') {
      out.push(unquote(cur.slice(0, -1)));
      cur = '';
    }
  }
  out.push(unquote(cur));
  return out.filter(Boolean);
}

/**
 * Decodes a scalar written by `quoteIfNeeded` (JSON-style `"..."`) or by hand (YAML `'...'` with `''` for a
 * quote). Unquoted values are only trimmed.
 */
function unquote(value: string): string {
  const v = value.trim();
  if (v.length < 2 || v.at(-1) !== v[0]) return v;
  if (v[0] === '"') {
    try {
      return String(JSON.parse(v));
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v[0] === "'") return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** Quotes a frontmatter scalar when YAML would misread it. Control characters are escaped, never written raw. */
function quoteIfNeeded(value: string): string {
  return /[,\]\[:#"'\\\u0000-\u001f]/.test(value) || value !== value.trim() ? JSON.stringify(value) : value;
}

/**
 * Collapses whitespace runs (newlines included) to one space and trims. Titles, aliases and tags go through it
 * before they are written, so a value can never span lines and break the frontmatter.
 */
export function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Splits a markdown file into frontmatter lines and body lines, classifying entry lines. */
export function parseNote(source: string): ParsedNote {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const trailingNewline = source.endsWith('\n');
  const lines = source.split(/\r?\n/);
  if (trailingNewline) lines.pop();

  let frontmatterLines: string[] = [];
  let hasFrontmatter = false;
  let start = 0;
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1);
    if (close > 0) {
      hasFrontmatter = true;
      frontmatterLines = lines.slice(1, close);
      start = close + 1;
    }
  }
  const body = lines.slice(start).map(parseBodyLine);
  return { frontmatterLines, hasFrontmatter, body, trailingNewline, eol };
}

function parseBodyLine(raw: string): BodyLine {
  const m = ENTRY_RE.exec(raw);
  if (!m) return { kind: 'text', raw };
  const [, date, type, text, id] = m;
  const tags = [...(text ?? '').matchAll(TAG_RE)].map(t => t[1]!.toLowerCase());
  return { kind: 'entry', raw, date: date!, type: type!, text: text!, tags, id: id ?? null };
}

/** Joins the parsed lines back into file text. Unedited notes round-trip exactly. */
export function serializeNote(note: ParsedNote): string {
  const out: string[] = [];
  if (note.hasFrontmatter) out.push('---', ...note.frontmatterLines, '---');
  for (const line of note.body) out.push(line.raw);
  return out.join(note.eol) + (note.trailingNewline || out.length === 0 ? note.eol : '');
}

/** Reads the known frontmatter keys. Missing keys fall back to the given defaults. */
export function readFrontmatter(note: ParsedNote, fallback: { title: string; category: string }): Frontmatter {
  const data = new Map<string, string>();
  const lines = note.frontmatterLines;
  for (let i = 0; i < lines.length; i++) {
    const m = KEY_LINE_RE.exec(lines[i]!);
    if (!m) continue;
    let value = (m[2] ?? '').trim();
    if (value === '') {
      // YAML block list: following "- item" lines.
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1]!)) {
        items.push(unquote(lines[++i]!.replace(/^\s+-\s+/, '')));
      }
      if (items.length) value = `[${items.map(quoteIfNeeded).join(', ')}]`;
    }
    data.set(m[1]!, value);
  }
  const list = (key: string) => (data.has(key) ? splitList(data.get(key)!) : []);
  return {
    title: unquote(data.get('title') ?? '') || fallback.title,
    category: unquote(data.get('category') ?? '') || fallback.category,
    tags: list('tags'),
    aliases: list('aliases'),
    updated: unquote(data.get('updated') ?? '') || null,
    reviewed: unquote(data.get('reviewed') ?? '') !== 'false',
  };
}

/** Sets one top-level frontmatter key, replacing the existing line (and its block list) or inserting it. */
export function setFrontmatterKey(note: ParsedNote, key: string, value: string): void {
  const lines = note.frontmatterLines;
  const idx = lines.findIndex(l => KEY_LINE_RE.exec(l)?.[1] === key);
  const next = `${key}: ${value}`;
  if (idx === -1) {
    lines.push(next);
  } else {
    let end = idx + 1;
    while (end < lines.length && /^\s+-\s+/.test(lines[end]!)) end++;
    lines.splice(idx, end - idx, next);
  }
  note.hasFrontmatter = true;
}

/** Writes a list-valued frontmatter key in inline form (`[a, b]`). */
export function setFrontmatterList(note: ParsedNote, key: string, items: string[]): void {
  setFrontmatterKey(note, key, `[${items.map(quoteIfNeeded).join(', ')}]`);
}

/** Entries of a note, each with a stable key (`^id`, or `h<hash>[-n]` for lines that have no id). */
export function listEntries(note: ParsedNote): KeyedEntry[] {
  const seen = new Map<string, number>();
  const out: KeyedEntry[] = [];
  note.body.forEach((line, index) => {
    if (line.kind !== 'entry') return;
    let key = line.id ?? `h${shortHash(line.raw)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n > 0) key = `${key}-${n}`;
    out.push({ ...line, key, index });
  });
  return out;
}

/** The free text between frontmatter and entries (description, headings). Entries are excluded. */
export function bodyText(note: ParsedNote): string {
  return note.body
    .filter((l): l is TextLine => l.kind === 'text')
    .map(l => l.raw.trim())
    .filter(Boolean)
    .join('\n');
}

/** Formats an entry line. `text` must be a single line. */
export function formatEntryLine(entry: { date: string; type: string; text: string; id: string }): string {
  return `- ${entry.date} [${entry.type}] ${entry.text.replace(/\s*\n\s*/g, ' ').trim()} ^${entry.id}`;
}

/** Random short id (4 lowercase alphanumerics) not present in `taken`, Obsidian block-reference style. */
export function newEntryId(taken: Iterable<string>): string {
  const used = new Set(taken);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let len = 4; ; len++) {
    for (let attempt = 0; attempt < 50; attempt++) {
      let id = '';
      for (let i = 0; i < len; i++) id += alphabet[randomInt(alphabet.length)];
      if (!used.has(id)) return id;
    }
  }
}

/** Appends an entry line after the last entry (or at the end of the body). Returns the new line's id. */
export function appendEntry(note: ParsedNote, entry: { date: string; type: string; text: string }): string {
  const taken = listEntries(note).map(e => e.id ?? e.key);
  const id = newEntryId(taken);
  const raw = formatEntryLine({ ...entry, id });
  const parsed = parseBodyLine(raw);
  // Drop trailing blank lines so entries stay contiguous, then append.
  while (note.body.length && note.body.at(-1)!.kind === 'text' && note.body.at(-1)!.raw.trim() === '') note.body.pop();
  note.body.push(parsed);
  note.trailingNewline = true;
  return id;
}

/** Replaces one entry line (matched by key) with new text and/or type. Returns false when not found. */
export function replaceEntry(note: ParsedNote, key: string, patch: { text?: string; type?: string }): boolean {
  const entries = listEntries(note);
  const target = entries.find(e => e.key === key);
  if (!target) return false;
  const id = target.id ?? newEntryId(entries.map(e => e.id ?? e.key));
  note.body[target.index] = parseBodyLine(
    formatEntryLine({
      date: target.date,
      type: patch.type ?? target.type,
      text: patch.text ?? target.text,
      id,
    }),
  );
  return true;
}

/** Removes one entry line (matched by key). Returns false when not found. */
export function removeEntry(note: ParsedNote, key: string): boolean {
  const target = listEntries(note).find(e => e.key === key);
  if (!target) return false;
  note.body.splice(target.index, 1);
  return true;
}

/** Builds a brand-new note file. */
export function createNoteText(meta: {
  title: string;
  category: string;
  tags: string[];
  aliases: string[];
  updated: string;
  /** Pass false to mark the note as awaiting a duplicate review. */
  reviewed?: boolean;
}): string {
  const lines = [
    '---',
    `title: ${quoteIfNeeded(meta.title)}`,
    `category: ${meta.category}`,
    `tags: [${meta.tags.map(quoteIfNeeded).join(', ')}]`,
    `aliases: [${meta.aliases.map(quoteIfNeeded).join(', ')}]`,
    `updated: ${meta.updated}`,
    ...(meta.reviewed === false ? ['reviewed: false'] : []),
    '---',
    '',
  ];
  return lines.join('\n');
}

function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
