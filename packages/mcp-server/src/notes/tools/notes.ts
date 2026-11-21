import { z } from 'zod';
import { ENTRY_TYPES } from '@my-hub/notes';
import { currentDateString } from '@my-hub/shared/utils';
import { yyyyMmDdSchema } from '../../shared/schemas';
import { toolResponse } from '../../shared/toolsUtils';
import type { ToolHandler } from '../../shared/types';
import { notesFor } from '../runtime';

const pathSchema = z
  .string()
  .trim()
  .describe('Note path as returned by notes_search / notes_browse ("<category>/<slug>.md").');
const entryIdSchema = z
  .string()
  .trim()
  .min(1)
  .describe('Entry id (the ^id of the line, without the caret), as returned in search results.');

// ---- notes_search -------------------------------------------------------------

export const SearchNotesSchema = z.object({
  queries: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(5)
    .describe('2-4 phrasings of the same question: synonyms plus Romanian / Russian / English translations.'),
  category: z.string().trim().optional().describe('Restrict to one category folder.'),
  limit: z.number().int().min(1).max(20).optional().describe('Notes to return. Default 5.'),
});

export const searchNotesTool: ToolHandler<typeof SearchNotesSchema.shape> = async (input, { userId }) => {
  const notes = await notesFor(userId);
  const { hits, timings } = await notes.search(input);
  return toolResponse({ count: hits.length, hits, timings });
};

// ---- notes_read ---------------------------------------------------------------

export const ReadNoteSchema = z.object({ path: pathSchema });

export const readNoteTool: ToolHandler<typeof ReadNoteSchema.shape> = async ({ path }, { userId }) =>
  toolResponse(await (await notesFor(userId)).read(path));

// ---- notes_remember -----------------------------------------------------------

export const RememberSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1)
    .describe(
      'What the note is about, as a short title naming the product, service or topic. For a list the user ' +
        'wants back (places to visit, foods to try, books, gift ideas) use the list itself as the title.',
    ),
  text: z.string().trim().min(1).describe('One line: the fact itself. No newlines.'),
  type: z.enum(ENTRY_TYPES).describe('fact | verdict (was it good?) | contact | price | how-to.'),
  path: z
    .string()
    .trim()
    .optional()
    .describe('Write to exactly this note (appends, or creates it) instead of matching `subject`.'),
  category: z
    .string()
    .trim()
    .optional()
    .describe('Folder for a NEW note: services, home, car, appliances, garden, shops... Default "misc".'),
  tags: z.array(z.string().trim().min(1)).max(10).optional().describe('Note-level tags.'),
  aliases: z
    .array(z.string().trim().min(1))
    .max(10)
    .optional()
    .describe('Other names for this subject (RO / RU / EN) so later searches find it.'),
  date: yyyyMmDdSchema.optional().describe('When it happened (YYYY-MM-DD). Defaults to today.'),
});

export const rememberTool: ToolHandler<typeof RememberSchema.shape> = async (input, { userId, timezone }) => {
  const notes = await notesFor(userId);
  return toolResponse(await notes.remember({ ...input, date: input.date ?? currentDateString(timezone) }));
};

// ---- notes_edit_entry / notes_delete_entry / notes_add_alias --------------------

export const EditEntrySchema = z.object({
  path: pathSchema,
  entryId: entryIdSchema,
  text: z.string().trim().min(1).optional().describe('New text for the line (one line).'),
  type: z.enum(ENTRY_TYPES).optional().describe('New type.'),
});

export const editEntryTool: ToolHandler<typeof EditEntrySchema.shape> = async (
  { path, entryId, text, type },
  { userId },
) => {
  if (text === undefined && type === undefined) return toolResponse({ error: 'Pass text and/or type.' });
  return toolResponse(await (await notesFor(userId)).editEntry(path, entryId, { text, type }));
};

export const DeleteEntrySchema = z.object({ path: pathSchema, entryId: entryIdSchema });

export const deleteEntryTool: ToolHandler<typeof DeleteEntrySchema.shape> = async ({ path, entryId }, { userId }) =>
  toolResponse(await (await notesFor(userId)).deleteEntry(path, entryId));

export const AddAliasSchema = z.object({
  path: pathSchema,
  alias: z.string().trim().min(1).describe('Another name for the note, e.g. its Romanian or Russian name.'),
});

export const addAliasTool: ToolHandler<typeof AddAliasSchema.shape> = async ({ path, alias }, { userId }) =>
  toolResponse(await (await notesFor(userId)).addAlias(path, alias));

// ---- notes_recent / notes_browse -------------------------------------------------

export const RecentSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('How many entries. Default 10.'),
});

export const recentNotesTool: ToolHandler<typeof RecentSchema.shape> = async ({ limit }, { userId }) =>
  toolResponse({ entries: await (await notesFor(userId)).recent(limit ?? 10) });

export const BrowseNotesSchema = z.object({
  queries: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(5)
    .optional()
    .describe('1-5 phrasings (RO/RU/EN) to rank the headers by relevance. Omit to list by category and title.'),
  category: z.string().trim().optional().describe('Only this category folder.'),
  tag: z.string().trim().optional().describe('Only notes with this tag.'),
  updatedSince: yyyyMmDdSchema.optional().describe('Only notes updated on or after this date (YYYY-MM-DD).'),
  unreviewedOnly: z.boolean().optional().describe('Only notes not yet checked by a duplicate review.'),
  limit: z.number().int().min(1).max(200).optional().describe('Headers to return. Default 50.'),
});

export const browseNotesTool: ToolHandler<typeof BrowseNotesSchema.shape> = async (input, { userId }) => {
  const notes = await (await notesFor(userId)).browse(input);
  return toolResponse({ count: notes.length, notes });
};

// ---- notes_review_duplicates / notes_merge / notes_mark_reviewed -------------------

export const ReviewDuplicatesSchema = z.object({
  limit: z.number().int().min(1).max(20).optional().describe('Unreviewed notes per call. Default 5.'),
});

export const reviewDuplicatesTool: ToolHandler<typeof ReviewDuplicatesSchema.shape> = async ({ limit }, { userId }) =>
  toolResponse(await (await notesFor(userId)).reviewQueue({ limit: limit ?? 5, suggestions: 5 }));

export const MergeNotesSchema = z.object({
  from: pathSchema.describe('The duplicate note to fold in and delete.'),
  into: pathSchema.describe('The note that keeps everything (the older, better-named one).'),
});

export const mergeNotesTool: ToolHandler<typeof MergeNotesSchema.shape> = async ({ from, into }, { userId }) =>
  toolResponse(await (await notesFor(userId)).merge(from, into));

export const MarkReviewedSchema = z.object({
  paths: z.array(pathSchema).min(1).max(50).describe('Notes that were checked (merged away notes need not be listed).'),
});

export const markReviewedTool: ToolHandler<typeof MarkReviewedSchema.shape> = async ({ paths }, { userId }) =>
  toolResponse(await (await notesFor(userId)).markReviewed(paths));
