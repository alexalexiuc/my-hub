import { HandledError } from '../../shared/errors';
import { z } from 'zod';
import { ToolHandler } from '../../shared/types';
import { toolResponse } from '../../shared/toolsUtils';
import {
  getUserActiveBudget,
  getLabels,
  getTransactions,
  countTransactions,
  getAccounts,
  getCategories,
  getPayees,
  getGroups,
  findPayeeByNameOrAlias,
} from '@my-hub/shared/services';

// ─── list_labels ─────────────────────────────────────────────────────────────

export const ListLabelsSchema = z.object({});

export const listLabelsTool: ToolHandler<typeof ListLabelsSchema.shape> = async (_input, context) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  const labels = await getLabels(userId, budget.id);
  return toolResponse({ labels });
};

// ─── get_transactions_by_label ────────────────────────────────────────────────

export const GetTransactionsByLabelSchema = z.object({
  label: z.string().min(1).describe('The label string to filter transactions by (case-sensitive exact match).'),
  payeeName: z.string().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  includeCorrections: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const getTransactionsByLabelTool: ToolHandler<typeof GetTransactionsByLabelSchema.shape> = async (
  input,
  context,
) => {
  const { userId } = context;

  const budget = await getUserActiveBudget(userId);
  if (!budget) throw new HandledError('No active budget. Set an active budget in the Hub first.');

  let payeeId: number | undefined;
  if (input.payeeName !== undefined) {
    const match = await findPayeeByNameOrAlias(userId, budget.id, input.payeeName);
    if (!match) return toolResponse({ transactions: [], total: 0 });
    payeeId = match.id;
  }

  const opts = {
    label: input.label,
    payeeId,
    fromDate: input.dateFrom,
    toDate: input.dateTo,
    includeCorrections: input.includeCorrections,
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
  };

  const [txns, total, accounts, categories, payees, groups] = await Promise.all([
    getTransactions(userId, budget.id, opts),
    countTransactions(userId, budget.id, opts),
    getAccounts(userId, budget.id, { includeArchived: true }),
    getCategories(userId, budget.id),
    getPayees(userId, budget.id),
    getGroups(userId, budget.id),
  ]);

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const payeeMap = new Map(payees.map(p => [p.id, p]));
  const groupMap = new Map(groups.map(g => [g.id, g.name]));

  const transactions = txns.map(tx => {
    const fromAcct = accountMap.get(tx.accountId);
    const toAcct = tx.toAccountId != null ? accountMap.get(tx.toAccountId) : null;
    const cat = tx.categoryId != null ? categoryMap.get(tx.categoryId) : null;
    const payee = tx.payeeId != null ? payeeMap.get(tx.payeeId) : null;
    const groupName = cat?.groupId ? groupMap.get(cat.groupId) : null;

    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      notes: tx.notes,
      labels: (tx.labels as string[]) ?? [],
      isCorrection: tx.isCorrection,
      account: fromAcct ? { id: fromAcct.id, name: fromAcct.name, currency: fromAcct.currency } : null,
      ...(toAcct ? { toAccount: { id: toAcct.id, name: toAcct.name, currency: toAcct.currency } } : {}),
      ...(cat
        ? { category: { id: cat.id, name: cat.name, displayName: groupName ? `${groupName} > ${cat.name}` : cat.name } }
        : {}),
      ...(payee ? { payee: { id: payee.id, name: payee.name } } : {}),
      fromAccountBalanceAfter: tx.fromAccountBalanceAfter,
      createdAt: tx.createdAt,
    };
  });

  return toolResponse({ label: input.label, transactions, total });
};
