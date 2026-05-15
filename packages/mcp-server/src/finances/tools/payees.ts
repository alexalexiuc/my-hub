import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  mergePayees,
  upsertPayee,
  updatePayee,
  findPayeeByNameOrAlias,
  getPayees,
} from '@my-hub/shared/services';

// ─── upsert_payee ─────────────────────────────────────────────────────────────

export const UpsertPayeeSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe(
      'The canonical name for the payee (e.g. "Starbucks"). ' +
        'If a payee with this name (or a matching alias) already exists, it will be updated rather than duplicated.',
    ),
  alias: z
    .string()
    .min(1)
    .optional()
    .describe(
      'An alternative name or shorthand for the payee (e.g. "Starbucks Coffee"). ' +
        'Aliases are matched when resolving payee names during transaction entry, so adding an alias lets you ' +
        'use that alternate spelling without creating a duplicate payee.',
    ),
});

export const upsertPayeeTool: ToolHandler<typeof UpsertPayeeSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const beforeUpsert = await findPayeeByNameOrAlias(userId, budget.id, input.name);
  const isNew = beforeUpsert == null;

  const payee = isNew ? await upsertPayee(userId, budget.id, input.name) : beforeUpsert;

  let aliasAdded = false;
  if (input.alias) {
    const existingAliases = payee.aliases ?? [];
    const normalizedAlias = input.alias.trim().toLowerCase();
    const alreadyPresent = existingAliases.some(a => a.trim().toLowerCase() === normalizedAlias);
    if (!alreadyPresent) {
      await updatePayee(userId, budget.id, payee.id, { aliases: [...existingAliases, input.alias.trim()] });
      aliasAdded = true;
    }
  }

  let message: string;
  if (isNew) {
    message = input.alias
      ? `Payee "${payee.name}" created with alias "${input.alias.trim()}".`
      : `Payee "${payee.name}" created.`;
  } else if (aliasAdded) {
    message = `Payee "${payee.name}" already exists. Alias "${input.alias!.trim()}" added.`;
  } else if (input.alias) {
    message = `Payee "${payee.name}" already exists. Alias "${input.alias.trim()}" was already present.`;
  } else {
    message = `Payee "${payee.name}" already exists.`;
  }

  return toolResponse({ message, payeeId: payee.id, name: payee.name });
};

// ─── merge_payees ─────────────────────────────────────────────────────────────

export const MergePayeesSchema = z.object({
  targetId: z.number().int().positive().describe('The payee to merge everything into.'),
  sourceIds: z
    .array(z.number().int().positive())
    .min(1)
    .describe('Payee IDs to merge into targetId. All their transactions are reassigned, then they are deleted.'),
  canonicalName: z.string().min(1).optional().describe('Optional new name for the target payee after merge.'),
});

export const mergePayeesTool: ToolHandler<typeof MergePayeesSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const result = await mergePayees(userId, budget.id, input.targetId, input.sourceIds, input.canonicalName);

  return toolResponse(result);
};

// ─── list_payees ───────────────────────────────────────────────────────────────

function fuzzyMatch(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let hi = 0;
  for (const ch of n) {
    const found = h.indexOf(ch, hi);
    if (found === -1) return false;
    hi = found + 1;
  }
  return true;
}

export const ListPayeesSchema = z.object({
  search: z
    .string()
    .optional()
    .describe(
      'Optional fuzzy search term. Matches against payee name and all aliases. ' +
        'Fuzzy matching — characters must appear in order but need not be adjacent.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(200)
    .default(50)
    .describe('Maximum number of payees to return (default 50, max 200).'),
  offset: z.number().int().min(0).default(0).describe('Number of payees to skip for pagination (default 0).'),
});

export const listPayeesTool: ToolHandler<typeof ListPayeesSchema.shape> = async (input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const all = await getPayees(userId, budget.id);

  const filtered = input.search
    ? all.filter(p => fuzzyMatch(p.name, input.search!) || p.aliases.some(alias => fuzzyMatch(alias, input.search!)))
    : all;

  const page = filtered.slice(input.offset, input.offset + input.limit);

  return toolResponse({
    payees: page.map(p => ({
      id: p.id,
      name: p.name,
      aliases: p.aliases,
      description: p.description,
      useCount: p.useCount,
    })),
    total: filtered.length,
    limit: input.limit,
    offset: input.offset,
  });
};
