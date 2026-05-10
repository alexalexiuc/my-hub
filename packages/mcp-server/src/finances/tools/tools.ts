import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defineTool, withUserIdCheck } from '../../shared/toolsUtils';
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

const financeTools = [
  defineTool({
    name: 'finances_add_transactions',
    description:
      'Record one or more transactions (expenses, income, or transfers) in a single call. ' +
      'Accepts an array so a full batch parsed from a bank screenshot can be submitted in one step. ' +
      'If payeeName matches an existing canonical payee alias, the existing payee is reused instead of creating a duplicate. ' +
      'Each item is processed independently — a duplicate warning on one does not block the others. ' +
      'Always populate the notes field with a plain-language summary of the transaction. ' +
      'The tool automatically detects possible duplicates and includes a warning in the result if found. ' +
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
      withUserIdCheck(tool.callback),
    );
  }
}
