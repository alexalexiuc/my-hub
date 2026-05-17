import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, wrapToolHandler } from '../../shared/toolsUtils';
import {
  AddTransactionsSchema,
  UpdateTransactionSchema,
  DeleteTransactionSchema,
  QueryTransactionsSchema,
  addTransactionsTool,
  updateTransactionTool,
  deleteTransactionTool,
  queryTransactionsTool,
} from './transactions';
import {
  GetBudgetProgressSchema,
  GetCashflowSummarySchema,
  GetSpendingByPayeeSchema,
  GetSpendingAggregatesSchema,
  GetNetWorthSummarySchema,
  getBudgetProgressTool,
  getCashflowSummaryTool,
  getSpendingByPayeeTool,
  getSpendingAggregatesTool,
  getNetWorthSummaryTool,
} from './reporting';
import { ListContextSchema, listContextTool } from './context';
import { UpsertAccountSchema, upsertAccountTool } from './accounts';
import {
  ListPayeesSchema,
  listPayeesTool,
  MergePayeesSchema,
  mergePayeesTool,
  UpsertPayeeSchema,
  upsertPayeeTool,
} from './payees';
import { UpsertCategorySchema, upsertCategoryTool } from './categories';
import { ListLabelsSchema, listLabelsTool, GetTransactionsByLabelSchema, getTransactionsByLabelTool } from './labels';

const financeTools = [
  defineTool({
    name: 'finances_list_context',
    description:
      'Returns all accounts, categories, and groups in a single call. ' +
      'Call this first before using any other finances tool that requires an accountId or categoryId. ' +
      'Use account IDs for transaction tools and category IDs for budget tools. ' +
      'Archived accounts are excluded by default; pass includeArchived: true to include them.',
    inputSchema: ListContextSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listContextTool,
  }),
  defineTool({
    name: 'finances_upsert_account',
    description:
      'Create a new account or update an existing one. ' +
      'Omit id to create; provide id to update only the fields you supply. ' +
      'Use openingBalance + openingDate to record a starting balance as a correction transaction — ' +
      'this does not overwrite existing transaction history. ' +
      'Loan and credit card accounts accept negative opening balances.',
    inputSchema: UpsertAccountSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: upsertAccountTool,
  }),
  defineTool({
    name: 'finances_upsert_category',
    description:
      'Create a new spending category or update an existing one. ' +
      'Omit id to create; provide id to update only the fields you supply. ' +
      'icon and color are required. ' +
      'Use groupName to assign the category to a group (the "parent" section visible in the Hub); ' +
      'if the group does not exist, it is created automatically. ' +
      'Set monthlyTarget to define a monthly spending limit; pass null to remove it. ' +
      'Use finances_list_context to see available group names.',
    inputSchema: UpsertCategorySchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: upsertCategoryTool,
  }),
  defineTool({
    name: 'finances_list_payees',
    description:
      'List all payees for the active budget, with optional fuzzy search and pagination. ' +
      'Fuzzy search matches against payee name and aliases — characters must appear in order but need not be adjacent. ' +
      'Results are sorted by usage frequency (most-used first), then by most-recently used, then alphabetically. ' +
      'Use limit and offset for pagination.',
    inputSchema: ListPayeesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listPayeesTool,
  }),
  defineTool({
    name: 'finances_upsert_payee',
    description:
      'Create a new payee or update an existing one. ' +
      'If a payee with the given name (or matching alias) already exists, it is returned as-is. ' +
      'Provide alias to add an alternative name that will be recognized during transaction entry — ' +
      'for example, alias "Starbucks Coffee" maps to the canonical payee "Starbucks". ' +
      'Use this tool before adding transactions when you know the payee does not yet exist, ' +
      'or after adding transactions that returned a payee_not_found error.',
    inputSchema: UpsertPayeeSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: upsertPayeeTool,
  }),
  defineTool({
    name: 'finances_merge_payees',
    description:
      'Merge duplicate payees: all transactions from sourceIds are reassigned to targetId, ' +
      'then the source payees are deleted. ' +
      'Optionally rename the target payee to a canonical name after the merge. ' +
      'This operation is irreversible — confirm payee IDs from finances_upsert_payee or prior tool responses before calling.',
    inputSchema: MergePayeesSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: mergePayeesTool,
  }),
  defineTool({
    name: 'finances_list_labels',
    description:
      'List all known label strings for the active budget. ' +
      'Use the returned values for autocomplete when adding or updating transactions with labels.',
    inputSchema: ListLabelsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: listLabelsTool,
  }),
  defineTool({
    name: 'finances_get_transactions_by_label',
    description:
      'Fetch all transactions tagged with a specific label, with optional payee, date range, and pagination filters. ' +
      'Returns resolved account, category, and payee names inline. ' +
      'Use finances_list_labels first to discover available label strings.',
    inputSchema: GetTransactionsByLabelSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getTransactionsByLabelTool,
  }),
  defineTool({
    name: 'finances_add_transactions',
    description:
      'Record one or more transactions (expenses, income, or transfers) against a single account in one call. ' +
      'Provide accountId at the root — all transactions in the batch go to the same account. ' +
      'Accepts an array so a full batch parsed from a bank screenshot can be submitted in one step. ' +
      'If payeeName matches an existing canonical payee alias, the existing payee is reused instead of creating a duplicate. ' +
      'Each item is processed independently — a duplicate warning on one does not block the others. ' +
      'Only populate the notes field when you have meaningful information to add. ' +
      'The tool automatically detects possible duplicates and includes a warning in the result if found. ' +
      'If a payeeName is not recognized and createPayee is false (default), the call returns a payee_not_found error — ' +
      'use finances_upsert_payee to create the payee first, or set createPayee: true to create it automatically. ' +
      '\n\nExtras field guidance:\n' +
      '- extras is optional. Provide it only when you have meaningful structured metadata beyond the core transaction fields. ' +
      '- For receipt transactions, populate extras.items with the line items that are clearly visible on the receipt. ' +
      '  Only include items you can actually read — do not guess, infer, or fabricate entries that are not visible. ' +
      '  If line items are partially illegible or absent, omit the items array entirely. ' +
      '- extras.taxAmount, tipAmount, discountAmount should only be set when those values are explicitly shown on the receipt. ' +
      '- extras.rawInput should contain the original text or description the transaction was parsed from.',
    inputSchema: AddTransactionsSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: addTransactionsTool,
  }),
  defineTool({
    name: 'finances_update_transaction',
    description:
      'Edit an existing transaction. Only transactions you added can be updated. ' +
      'Account balances are recomputed atomically when amount, account, or type changes.',
    inputSchema: UpdateTransactionSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: false },
    callback: updateTransactionTool,
  }),
  defineTool({
    name: 'finances_delete_transaction',
    description:
      'Delete a transaction. Only transactions you added can be deleted. ' +
      'The balance effect is reversed atomically.',
    inputSchema: DeleteTransactionSchema.shape,
    annotations: { idempotentHint: false, destructiveHint: true },
    callback: deleteTransactionTool,
  }),
  defineTool({
    name: 'finances_query_transactions',
    description:
      'Search and list transactions with optional filters. Returns resolved account, category, and payee names inline. ' +
      'payeeName matching is alias-aware for existing payees. ' +
      'Correction transactions are excluded by default. Supports pagination via limit/offset.',
    inputSchema: QueryTransactionsSchema.shape,
    annotations: { readOnlyHint: true },
    callback: queryTransactionsTool,
  }),
  defineTool({
    name: 'finances_get_budget_progress',
    description:
      'Show category spending vs monthly targets for a given month (defaults to current month). ' +
      'Use to answer "how am I doing on my budget?" or "what categories am I over on?"',
    inputSchema: GetBudgetProgressSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getBudgetProgressTool,
  }),
  defineTool({
    name: 'finances_get_cashflow_summary',
    description:
      'Summarise income vs expenses and net cashflow for a date range. ' +
      'Breaks results down by month for multi-month ranges.',
    inputSchema: GetCashflowSummarySchema.shape,
    annotations: { readOnlyHint: true },
    callback: getCashflowSummaryTool,
  }),
  defineTool({
    name: 'finances_get_spending_by_payee',
    description:
      'Show total spend per payee for a date range, sorted by highest spend. ' +
      'Use to answer "where am I spending the most?" or "how much did I spend at [shop]?"',
    inputSchema: GetSpendingByPayeeSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getSpendingByPayeeTool,
  }),
  defineTool({
    name: 'finances_get_spending_aggregates',
    description:
      'Flexible aggregation: group spending by category, payee, account, month, or transaction type. ' +
      'Use for ad-hoc analysis like "food spend month by month" or "compare accounts by outflow".',
    inputSchema: GetSpendingAggregatesSchema.shape,
    annotations: { readOnlyHint: true },
    callback: getSpendingAggregatesTool,
  }),
  defineTool({
    name: 'finances_get_net_worth_summary',
    description:
      'Current net worth snapshot across all non-archived accounts, broken down by account type. ' +
      'Includes 12-month history from saved snapshots.',
    inputSchema: GetNetWorthSummarySchema.shape,
    annotations: { readOnlyHint: true },
    callback: getNetWorthSummaryTool,
  }),
];

export function registerFinancesTools(server: McpServer): void {
  for (const tool of financeTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      wrapToolHandler(tool.callback),
    );
  }
}
