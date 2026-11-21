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
  .describe('Note path as returned by notes_search / notes_list, e.g. "services/carpet-cleaning.md".');
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
    .describe(
      '2-4 phrasings of the same question: synonyms plus Romanian / Russian / English translations, ' +
        'e.g. ["carpet cleaning", "rug washing", "curățare covoare", "химчистка ковров"].',
    ),
  category: z.string().trim().optional().describe('Restrict to one category folder, e.g. "car".'),
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
    .describe('What the note is about, as a short title: "Carpet cleaning", "Engine oil", "Washing detergent".'),
  text: z
    .string()
    .trim()
    .min(1)
    .describe('One line: the fact itself, e.g. "CleanPro, 069123456, picked up from the flat". No newlines.'),
  type: z.enum(ENTRY_TYPES).describe('fact | verdict (was it good?) | contact | price | how-to.'),
  path: z
    .string()
    .trim()
    .optional()
    .describe('Skip subject matching and write to exactly this note. Use it after an "ambiguous" answer.'),
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
  const result = await notes.remember({ ...input, date: input.date ?? currentDateString(timezone) });
  if (result.status === 'ambiguous') {
    return toolResponse({
      status: 'ambiguous',
      message: 'Several existing notes fit this subject. Nothing was saved. Retry with `path` set to the right one.',
      candidates: result.candidates.map(c => ({
        path: c.path,
        title: c.title,
        score: Math.round(c.score * 100) / 100,
      })),
    });
  }
  return toolResponse(result);
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
  alias: z.string().trim().min(1).describe('Another name for the note, e.g. "химчистка ковров".'),
});

export const addAliasTool: ToolHandler<typeof AddAliasSchema.shape> = async ({ path, alias }, { userId }) =>
  toolResponse(await (await notesFor(userId)).addAlias(path, alias));

// ---- notes_recent / notes_list --------------------------------------------------

export const RecentSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe('How many entries. Default 10.'),
});

export const recentNotesTool: ToolHandler<typeof RecentSchema.shape> = async ({ limit }, { userId }) =>
  toolResponse({ entries: await (await notesFor(userId)).recent(limit ?? 10) });

export const ListNotesSchema = z.object({
  category: z.string().trim().optional().describe('Only this category folder.'),
});

export const listNotesTool: ToolHandler<typeof ListNotesSchema.shape> = async ({ category }, { userId }) =>
  toolResponse({ notes: await (await notesFor(userId)).list(category) });
