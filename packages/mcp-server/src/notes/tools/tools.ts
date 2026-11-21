import { McpServer } from '@modelcontextprotocol/server';
import { defineTool, registerTools } from '../../shared/toolsUtils';
import {
  AddAliasSchema,
  addAliasTool,
  DeleteEntrySchema,
  deleteEntryTool,
  EditEntrySchema,
  editEntryTool,
  ListNotesSchema,
  listNotesTool,
  ReadNoteSchema,
  readNoteTool,
  RecentSchema,
  recentNotesTool,
  RememberSchema,
  rememberTool,
  SearchNotesSchema,
  searchNotesTool,
} from './notes';

const SCOPE =
  "The user's personal 'remember this' index of small practical facts about THINGS and SERVICES: which vendor " +
  'was used, which product or oil or detergent was better, a price paid, a how-to. Not for biographical or ' +
  'personal facts about the user. Notes are mixed Romanian / Russian / English.';

const notesTools = [
  defineTool({
    name: 'notes_search',
    description:
      `${SCOPE} Search it before answering "which X did I use / what was that company / how much did it cost". ` +
      'Pass 2-4 query variants of the same question: synonyms and RO/RU/EN translations ' +
      '(["carpet cleaning", "rug washing", "curățare covoare", "химчистка ковров"]). Typos and vague wording are ' +
      'fine. Returns the best notes (path, title, category, score) each with its best matching entry lines ' +
      '(id, date, type, text) - usually enough to answer without notes_read. `matchedBy` shows which search ' +
      'legs hit; a hit matched only by "vec"/"namesVec" with a low score may be unrelated, so say when nothing ' +
      'convincing was found instead of guessing. `timings` is server-side latency.',
    inputSchema: SearchNotesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: searchNotesTool,
  }),
  defineTool({
    name: 'notes_read',
    description:
      'Read one whole note (Markdown with frontmatter and every dated entry line). Use after notes_search when ' +
      'the snippets are not enough, e.g. to compare all verdicts for a subject. Example path: "car/engine-oil.md".',
    inputSchema: ReadNoteSchema.shape,
    annotations: { readOnlyHint: true },
    callback: readNoteTool,
  }),
  defineTool({
    name: 'notes_remember',
    description:
      `Save one fact as a dated entry. ${SCOPE} ` +
      'WHEN: the user explicitly asks ("remember", "note that", "add to my notes", "save this"). When the user ' +
      'merely states a durable practical fact (vendor used, product verdict, price paid, oil grade, filter size), ' +
      'offer to save it in ONE short line and wait; never save silently. ' +
      'HOW: the server resolves `subject` to an existing note when one is similar (so "rugs cleaning" lands in ' +
      '"Carpet cleaning") and appends; otherwise it creates a note. It is fine to notes_search first to avoid ' +
      'duplicates. Give `aliases` in RO/RU/EN for new subjects, and `category` for new notes. One fact per call. ' +
      'If the answer is status "ambiguous", nothing was saved: pick the right candidate and call again with ' +
      '`path`. After a call with created: true, tell the user the new note title. ' +
      'Example: subject "Carpet cleaning", type "contact", text "CleanPro, 069123456, picked up from the flat", ' +
      'category "services", aliases ["rug cleaning", "covoare", "химчистка ковров"].',
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
      'tries to find it. Example: path "services/carpet-cleaning.md", alias "химчистка ковров".',
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
    name: 'notes_list',
    description:
      'List notes (path, title, category, entry count), optionally for one category. For browsing; ' +
      'use notes_search to find something specific.',
    inputSchema: ListNotesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listNotesTool,
  }),
];

export function registerNotesTools(server: McpServer): void {
  registerTools(server, notesTools);
}
