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
  "The user's personal 'remember this' index of small practical facts about THINGS and SERVICES: which vendor " +
  'or product was used and how it turned out, a price paid, a how-to. Not for biographical or personal facts ' +
  'about the user. Notes are mixed Romanian / Russian / English.';

const notesTools = [
  defineTool({
    name: 'notes_search',
    description:
      `${SCOPE} Search it before answering "which X did I use / what was that company / how much did it cost". ` +
      'Pass 2-4 query variants of the same question: synonyms and RO/RU/EN translations. Typos and vague ' +
      'wording are fine. Returns the best notes (path, title, category, score) each with its best matching entry lines ' +
      '(id, date, type, text) - usually enough to answer without notes_read. `matchedBy` shows which search ' +
      'legs hit; a hit matched only by "vec"/"namesVec" with a low score may be unrelated, so say when nothing ' +
      'convincing was found instead of guessing. `timings` is server-side latency. For one specific fact only; for ' +
      '"what is on my list / all my places / what do I have about X" use notes_browse, then notes_read.',
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
      'WHEN: the user explicitly asks ("remember", "note that", "add to my notes", "save this"). When the user ' +
      'merely states a durable practical fact (vendor used, product verdict, price paid, a part spec or size), ' +
      'offer to save it in ONE short line and wait; never save silently. ' +
      'HOW: appends to the note whose title or alias is exactly `subject` (case and accents ignored); otherwise ' +
      'creates a new note. It does not guess: near-duplicates are fine and get cleaned up in a review pass, so ' +
      'reuse the exact existing title when you know it (notes_search / notes_browse first if unsure). ' +
      'Collections the user wants back as a list (places to visit, foods to try, books, gift ideas) go in ONE list ' +
      'note: subject = the list itself, one entry per item. ' +
      'Give `aliases` in RO/RU/EN for new subjects, and `category` for new notes. One fact per call. ' +
      '`path` = write to exactly this note. After a call with created: true, tell the user the new note title.',
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
      'Take path and entryId from notes_search results.',
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
      'all my places / what do I have about X": browse, pick the relevant headers, then notes_read them.',
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
