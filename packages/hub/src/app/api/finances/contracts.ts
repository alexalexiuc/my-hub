import { z } from 'zod';

const categoryIconSchema = z.string().nullable();
const categoryColorSchema = z.string().nullable();

export const dashboardCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  spent: z.number(),
  target: z.number(),
});

export const dashboardGoalSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  balance: z.number(),
  target: z.number(),
});

export const dashboardTransactionSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.string(),
  notes: z.string().nullable(),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
});

export const availableBudgetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  defaultCurrency: z.string(),
  isOwner: z.boolean(),
});

export const financeDashboardDataSchema = z.object({
  hasBudget: z.literal(true),
  budgetId: z.number().int(),
  budgetName: z.string(),
  currency: z.string(),
  netWorth: z.number(),
  netWorthHistory: z.array(z.number()),
  monthlyIncome: z.number(),
  monthlyExpense: z.number(),
  categories: z.array(dashboardCategorySchema),
  goals: z.array(dashboardGoalSchema),
  recentTransactions: z.array(dashboardTransactionSchema),
});

export const noBudgetResponseSchema = z.object({
  hasBudget: z.literal(false),
  availableBudgets: z.array(availableBudgetSchema),
});

export const dashboardResponseSchema = z.union([financeDashboardDataSchema, noBudgetResponseSchema]);

export const accountItemSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    type: z.string(),
    currency: z.string(),
    balance: z.number(),
    archived: z.boolean(),
    creditLimit: z.number().optional(),
    statementDay: z.number().optional(),
    cardLastFour: z.string().optional(),
    cardName: z.string().optional(),
    targetAmount: z.number().optional(),
    deposited: z.number().optional(),
    principal: z.number().optional(),
    interestRate: z.number().optional(),
    termMonths: z.number().optional(),
    startDate: z.string().optional(),
    linkedItemName: z.string().optional(),
    counterpartyName: z.string().optional(),
    direction: z.string().optional(),
    dueDate: z.string().optional(),
    settled: z.boolean().optional(),
  })
  .loose();

export const accountsListResponseSchema = z.object({
  currency: z.string(),
  netWorth: z.number(),
  netWorthHistory: z.array(z.number()),
  accounts: z.array(accountItemSchema),
});

export const accountTransactionSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.string(),
  notes: z.string().nullable(),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
  balanceAfter: z.number().nullable(),
  isCorrection: z.boolean(),
});

export const accountDetailResponseSchema = z.object({
  account: accountItemSchema,
  transactions: z.array(accountTransactionSchema),
});

export const accountMutationResponseSchema = z.object({
  account: z.object({ id: z.number().int() }).loose(),
});

export const scheduleRowSchema = z.object({
  n: z.number().int(),
  date: z.string(),
  principalPart: z.number(),
  interestPart: z.number(),
  balance: z.number(),
  paid: z.boolean(),
  current: z.boolean(),
});

export const amortizationResponseSchema = z.object({
  accountId: z.number().int(),
  name: z.string(),
  currency: z.string(),
  currentBalance: z.number(),
  principal: z.number(),
  interestRate: z.number(),
  termMonths: z.number().int(),
  monthlyPayment: z.number(),
  startDate: z.string(),
  nextPaymentDate: z.string(),
  rows: z.array(scheduleRowSchema),
});

export const budgetMemberSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  joinedAt: z.string(),
});

export const budgetInfoSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    defaultCurrency: z.string(),
    createdByUserId: z.string(),
    isOwner: z.boolean(),
    isActive: z.boolean().optional(),
  })
  .loose();

export const budgetDetailResponseSchema = z.object({
  budget: budgetInfoSchema,
  members: z.array(budgetMemberSchema),
});

export const budgetMutationResponseSchema = z.object({
  budget: budgetInfoSchema,
});

export const okResponseSchema = z.object({
  ok: z.literal(true),
});

export const budgetsListResponseSchema = z.object({
  budgets: z.array(budgetInfoSchema),
});

export const budgetCreateResponseSchema = z.object({
  budget: budgetInfoSchema,
});

export const categoryRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  monthlyTarget: z.number().nullable(),
  spent: z.number(),
  groupId: z.number().int().nullable(),
  sortOrder: z.number().int(),
});

export const categoryGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  sortOrder: z.number().int(),
  categories: z.array(categoryRowSchema),
});

export const categoriesResponseSchema = z.object({
  currency: z.string(),
  month: z.string(),
  groups: z.array(categoryGroupSchema),
  ungrouped: z.array(categoryRowSchema),
  totalSpent: z.number(),
  allCategories: z.array(categoryRowSchema),
});

export const categoryMutationResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
  })
  .loose();

export const groupMutationResponseSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
  })
  .loose();

export const goalItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  currency: z.string(),
  balance: z.number(),
  targetAmount: z.number(),
  monthlyAvg: z.number(),
  projectedMonths: z.number().int().nullable(),
});

export const goalsResponseSchema = z.object({
  currency: z.string(),
  goals: z.array(goalItemSchema),
});

export const payeeSuggestionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  useCount: z.number().int(),
  lastUsedAt: z.string().nullable(),
  recentCategoryId: z.number().int().nullable(),
  recentAccountId: z.number().int().nullable(),
});

export const payeesResponseSchema = z.object({
  payees: z.array(payeeSuggestionSchema),
  currency: z.string(),
});

export const payeeReportItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  txCount: z.number().int(),
  totalSpent: z.number(),
  lastDate: z.string(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
});

export const payeesReportResponseSchema = z.object({
  currency: z.string(),
  payees: z.array(payeeReportItemSchema),
});

export const reportsCashflowMonthSchema = z.object({
  month: z.string(),
  value: z.string(),
  income: z.number(),
  expense: z.number(),
});

export const reportsNetWorthPointSchema = z.object({
  month: z.string(),
  label: z.string(),
  netWorth: z.number(),
});

export const reportsResponseSchema = z.object({
  currency: z.string(),
  cashflow: z.array(reportsCashflowMonthSchema),
  netWorthHistory: z.array(reportsNetWorthPointSchema),
});

export const transactionListItemSchema = z.object({
  id: z.number().int(),
  date: z.string(),
  amount: z.number(),
  type: z.string(),
  isCorrection: z.boolean(),
  notes: z.string().nullable(),
  payeeName: z.string().nullable(),
  categoryName: z.string().nullable(),
  categoryColor: categoryColorSchema,
  categoryIcon: categoryIconSchema,
  accountName: z.string(),
  toAccountName: z.string().nullable(),
  addedByInitials: z.string().nullable(),
});

export const transactionsListResponseSchema = z.object({
  transactions: z.array(transactionListItemSchema),
  currency: z.string(),
});

export const transactionMutationResponseSchema = z.object({
  transaction: z.object({ id: z.number().int() }).loose(),
  listItem: transactionListItemSchema.optional(),
});

export const transactionFormAccountSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  currency: z.string(),
});

export const transactionFormCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  icon: categoryIconSchema,
  color: categoryColorSchema,
  groupId: z.number().int().nullable(),
});

export const transactionFormDataResponseSchema = z.object({
  currency: z.string(),
  accounts: z.array(transactionFormAccountSchema),
  categories: z.array(transactionFormCategorySchema),
});

export const transactionDetailSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  accountId: z.number().int(),
  toAccountId: z.number().int().nullable(),
  categoryId: z.number().int().nullable(),
  payeeId: z.number().int().nullable(),
  payeeName: z.string().nullable(),
  amount: z.number(),
  date: z.string(),
  notes: z.string().nullable(),
  isCorrection: z.boolean(),
});

export const netWorthItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.string(),
  balance: z.number(),
  currency: z.string(),
});

export const netWorthHistoryPointSchema = z.object({
  month: z.string(),
  label: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
});

export const netWorthResponseSchema = z.object({
  currency: z.string(),
  netWorth: z.number(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  assets: z.array(netWorthItemSchema),
  liabilities: z.array(netWorthItemSchema),
  history: z.array(netWorthHistoryPointSchema),
  deltaVsLastMonth: z.number().nullable(),
});

export type DashboardCategory = z.infer<typeof dashboardCategorySchema>;
export type DashboardGoal = z.infer<typeof dashboardGoalSchema>;
export type DashboardTransaction = z.infer<typeof dashboardTransactionSchema>;
export type AvailableBudget = z.infer<typeof availableBudgetSchema>;
export type FinanceDashboardData = z.infer<typeof financeDashboardDataSchema>;
export type NoBudgetResponse = z.infer<typeof noBudgetResponseSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export type AccountItem = z.infer<typeof accountItemSchema>;
export type AccountsListData = z.infer<typeof accountsListResponseSchema>;
export type AccountTransaction = z.infer<typeof accountTransactionSchema>;
export type AccountDetailData = z.infer<typeof accountDetailResponseSchema>;
export type ScheduleRow = z.infer<typeof scheduleRowSchema>;
export type AmortizationData = z.infer<typeof amortizationResponseSchema>;

export type BudgetMember = z.infer<typeof budgetMemberSchema>;
export type BudgetInfo = z.infer<typeof budgetInfoSchema>;
export type BudgetDetailResponse = z.infer<typeof budgetDetailResponseSchema>;
export type BudgetsListResponse = z.infer<typeof budgetsListResponseSchema>;

export type CategoryRow = z.infer<typeof categoryRowSchema>;
export type CategoryGroup = z.infer<typeof categoryGroupSchema>;
export type CategoriesResponse = z.infer<typeof categoriesResponseSchema>;

export type GoalItem = z.infer<typeof goalItemSchema>;
export type GoalsResponse = z.infer<typeof goalsResponseSchema>;

export type PayeeSuggestion = z.infer<typeof payeeSuggestionSchema>;
export type PayeesResponse = z.infer<typeof payeesResponseSchema>;
export type PayeeReportItem = z.infer<typeof payeeReportItemSchema>;
export type PayeesReportResponse = z.infer<typeof payeesReportResponseSchema>;

export type CashflowMonth = z.infer<typeof reportsCashflowMonthSchema>;
export type ReportsNetWorthPoint = z.infer<typeof reportsNetWorthPointSchema>;
export type ReportsData = z.infer<typeof reportsResponseSchema>;
export type TransactionListItem = z.infer<typeof transactionListItemSchema>;
export type TransactionsListResponse = z.infer<typeof transactionsListResponseSchema>;
export type TransactionMutationResponse = z.infer<typeof transactionMutationResponseSchema>;
export type TransactionFormDataResponse = z.infer<typeof transactionFormDataResponseSchema>;

export type NetWorthData = z.infer<typeof netWorthResponseSchema>;
export type TransactionDetail = z.infer<typeof transactionDetailSchema>;
