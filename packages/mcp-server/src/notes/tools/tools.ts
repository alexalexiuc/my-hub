import { McpServer } from '@modelcontextprotocol/server';
import { defineTool, registerTools } from '../../shared/toolsUtils';
import {
  AddAliasSchema,
  addAliasTool,
  BrowseNotesSchema,
  browseNotesTool,
  DeleteEntrySchema,
  deleteEntryTool,
  EditEntrySchema,
  editEntryTool,
  MarkReviewedSchema,
  markReviewedTool,
  MergeNotesSchema,
  mergeNotesTool,
  ReadNoteSchema,
  readNoteTool,
  RecentSchema,
  recentNotesTool,
  RememberSchema,
  rememberTool,
  ReviewDuplicatesSchema,
  reviewDuplicatesTool,
  SearchNotesSchema,
  searchNotesTool,
} from './notes';

const SCOPE =
  "The user's personal notebook: anything they want written down and found again later, such as practical " +
  'facts, vendors and verdicts, prices, how-tos, part sizes, ideas and short notes on any topic. Notes are mixed ' +
  'Romanian / Russian / English.';

const notesTools = [
  defineTool({
    name: 'notes_search',
    description:
      `${SCOPE} Search it before answering recall questions ("what was…", "did I note…", "what did I write ` +
      'about…", "which X did I use…", "how much did it cost"); never say you don\'t know before searching. ' +
      'Pass 2-4 query variants of the same question: synonyms and RO/RU/EN translations. Typos and vague ' +
      'wording are fine. Returns the best notes (path, title, category, score) each with its best matching entry lines ' +
      '(id, date, type, text) - usually enough to answer without notes_read. `matchedBy` shows which search ' +
      'legs hit; a hit matched only by "vec"/"namesVec" with a low score may be unrelated, so say when nothing ' +
      'convincing was found instead of guessing. `timings` is server-side latency. For one specific fact only; for ' +
      '"what is on my list / what do I have about X" use notes_browse, then notes_read.',
    inputSchema: SearchNotesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: searchNotesTool,
  }),
  defineTool({
    name: 'notes_read',
    description:
      'Read one whole note (Markdown with frontmatter and every dated entry line). Use after notes_search when ' +
      'the snippets are not enough, e.g. to compare all verdicts for a subject.',
    inputSchema: ReadNoteSchema.shape,
    annotations: { readOnlyHint: true },
    callback: readNoteTool,
  }),
  defineTool({
    name: 'notes_remember',
    description:
      `Save one fact as a dated entry. ${SCOPE} ` +
      'WHEN: the user explicitly asks ("note", "remember", "save", "add to my notes", "write down"): save. When ' +
      'the user states something they would plausibly want to look up later but did not ask to save it, offer ' +
      'in ONE short line and wait; never save silently. Never save passwords, card numbers or other secrets. ' +
      'HOW: appends to the note whose title or alias is exactly `subject` (case and accents ignored); otherwise ' +
      'creates a new note. It does not guess: near-duplicates are fine and get cleaned up in a review pass, so ' +
      'reuse the exact existing title when you know it (notes_search / notes_browse first if unsure). ' +
      'Give `aliases` in RO/RU/EN for new subjects, and `category` for new notes: reuse an existing one (call ' +
      'notes_browse to see them with counts) rather than inventing a new one. One fact or note per call. ' +
      '`path` = write to exactly this note. After a call with created: true, tell the user the new note title. ' +
      'A result with newCategory: true created a new category folder and lists the `existingCategories`; there is ' +
      'no tool to move a note, so tell the user the new category was created (and name it).',
    inputSchema: RememberSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: rememberTool,
  }),
  defineTool({
    name: 'notes_edit_entry',
    description:
      'Fix one entry line (text and/or type) by its id, e.g. a wrong price. Take path and entryId from ' +
      'notes_search results. Never rewrites the rest of the note.',
    inputSchema: EditEntrySchema.shape,
    annotations: { idempotentHint: true, destructiveHint: true },
    callback: editEntryTool,
  }),
  defineTool({
    name: 'notes_delete_entry',
    description:
      'Delete one entry line by its id. Confirm with the user first unless they asked for it explicitly. ' +
      'Take path and entryId from notes_search results. Deleting the last entry of a note that has no other ' +
      'text deletes the note itself (noteDeleted: true).',
    inputSchema: DeleteEntrySchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteEntryTool,
  }),
  defineTool({
    name: 'notes_add_alias',
    description:
      'Teach the index another name for a note (e.g. a Russian or Romanian name), when a search needed several ' +
      'tries to find it.',
    inputSchema: AddAliasSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: addAliasTool,
  }),
  defineTool({
    name: 'notes_recent',
    description: 'The newest saved entries across all notes, newest first. For "what did I save lately?".',
    inputSchema: RecentSchema.shape,
    annotations: { readOnlyHint: true },
    callback: recentNotesTool,
  }),
  defineTool({
    name: 'notes_browse',
    description:
      'Note headers (title, category, aliases, tags, entry count, first line), filtered by category, tag, ' +
      'updatedSince, unreviewedOnly, and ranked by `queries` when given (up to 200). For "what is on my list / ' +
      'what do I have about X": browse, pick the relevant headers, then notes_read them. The result also has ' +
      '`categories` ({name, notes}: every category with its note count, unfiltered): check it before choosing a ' +
      '`category` for notes_remember.',
    inputSchema: BrowseNotesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: browseNotesTool,
  }),
  defineTool({
    name: 'notes_review_duplicates',
    description:
      'Only when the user asks to tidy, dedupe or review notes. Returns unreviewed notes, each with similar ' +
      'existing notes. For each: merge true duplicates with notes_merge (into the older, better-named note), leave ' +
      'distinct subjects alone, then notes_mark_reviewed the notes you checked that still exist (not the ones ' +
      'merged away). Tell the user what you merged. ' +
      'Call again while `remaining` > 0.',
    inputSchema: ReviewDuplicatesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: reviewDuplicatesTool,
  }),
  defineTool({
    name: 'notes_merge',
    description:
      'Fold a duplicate note into another: its entries (with dates and types), name and aliases, tags and free text ' +
      'move to `into`, and `from` is deleted. Use during notes_review_duplicates for true duplicates only.',
    inputSchema: MergeNotesSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: mergeNotesTool,
  }),
  defineTool({
    name: 'notes_mark_reviewed',
    description:
      'Mark notes as checked so notes_review_duplicates stops returning them. Call it for every note you looked ' +
      'at that still exists, including the ones that received a merge; a note merged away is already gone.',
    inputSchema: MarkReviewedSchema.shape,
    annotations: { idempotentHint: true, destructiveHint: false },
    callback: markReviewedTool,
  }),
];

export function registerNotesTools(server: McpServer): void {
  registerTools(server, notesTools);
}
