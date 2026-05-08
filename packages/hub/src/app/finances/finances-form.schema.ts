import { z } from 'zod';
import { AccountTypes, LentDirections, SupportedCurrencies, TransactionTypes } from '@my-hub/shared/constants';

// --- Add Group ---

export const AddGroupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
});

export type AddGroupValues = z.infer<typeof AddGroupSchema>;

export const defaultAddGroupValues: AddGroupValues = { name: '' };

// --- Add Goal ---

export const AddGoalSchema = z.object({
  name: z.string().trim().min(1, 'Goal name is required'),
  targetAmount: z.string(),
  openingBalance: z.string(),
});

export type AddGoalValues = z.infer<typeof AddGoalSchema>;

export const defaultAddGoalValues: AddGoalValues = {
  name: '',
  targetAmount: '',
  openingBalance: '0',
};

export function formToGoalBody(values: AddGoalValues) {
  return {
    name: values.name.trim(),
    type: AccountTypes.Goal,
    openingBalance: values.openingBalance ? parseFloat(values.openingBalance) : 0,
    details: { targetAmount: values.targetAmount ? parseFloat(values.targetAmount) : 0 },
  };
}

// --- Add Category ---

export const AddCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
  color: z.string().min(1),
  monthlyTarget: z.string(),
  groupId: z.string(),
});

export type AddCategoryValues = z.infer<typeof AddCategorySchema>;

export function defaultAddCategoryValues(defaultGroupId?: number | null): AddCategoryValues {
  return {
    name: '',
    icon: '',
    color: '#6ee7b7',
    monthlyTarget: '',
    groupId: defaultGroupId != null ? String(defaultGroupId) : '',
  };
}

export function formToCategoryBody(values: AddCategoryValues) {
  return {
    name: values.name.trim(),
    icon: values.icon,
    color: values.color,
    monthlyTarget: values.monthlyTarget ? parseFloat(values.monthlyTarget) : null,
    groupId: values.groupId ? parseInt(values.groupId) : null,
  };
}

// --- Edit Category (reuses same fields as Add) ---

export const EditCategorySchema = AddCategorySchema;
export type EditCategoryValues = AddCategoryValues;

export function categoryToEditValues(cat: {
  name: string;
  icon: string | null;
  color: string | null;
  monthlyTarget: number | null;
  groupId: number | null;
}): EditCategoryValues {
  return {
    name: cat.name,
    icon: cat.icon ?? '',
    color: cat.color ?? '#6ee7b7',
    monthlyTarget: cat.monthlyTarget != null ? String(cat.monthlyTarget) : '',
    groupId: cat.groupId != null ? String(cat.groupId) : '',
  };
}

// --- Add Account ---

export const AddAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  description: z.string(),
  type: z.string(),
  openingBalance: z.string(),
  // Credit Card
  creditLimit: z.string(),
  statementDay: z.string(),
  cardLastFour: z.string(),
  cardName: z.string(),
  // Bank
  bankCardLastFour: z.string(),
  bankCardName: z.string(),
  // Goal
  targetAmount: z.string(),
  // Investment
  deposited: z.string(),
  // Loan
  principal: z.string(),
  interestRate: z.string(),
  termMonths: z.string(),
  loanStartDate: z.string(),
  linkedItemName: z.string(),
  // Borrowed/Lent
  counterpartyName: z.string(),
  direction: z.string(),
  dueDate: z.string(),
});

export type AddAccountValues = z.infer<typeof AddAccountSchema>;

export const defaultAddAccountValues: AddAccountValues = {
  name: '',
  description: '',
  type: AccountTypes.Bank,
  openingBalance: '0',
  creditLimit: '',
  statementDay: '',
  cardLastFour: '',
  cardName: '',
  bankCardLastFour: '',
  bankCardName: '',
  targetAmount: '',
  deposited: '0',
  principal: '',
  interestRate: '',
  termMonths: '',
  loanStartDate: '',
  linkedItemName: '',
  counterpartyName: '',
  direction: LentDirections.Gave,
  dueDate: '',
};

export function formToAccountDetails(values: AddAccountValues): object | null {
  switch (values.type) {
    case AccountTypes.Bank:
      return {
        ...(values.bankCardLastFour ? { cardLastFour: values.bankCardLastFour } : {}),
        ...(values.bankCardName ? { cardName: values.bankCardName } : {}),
      };
    case AccountTypes.CreditCard:
      return {
        creditLimit: parseFloat(values.creditLimit) || 0,
        statementDay: parseInt(values.statementDay) || 1,
        ...(values.cardLastFour ? { cardLastFour: values.cardLastFour } : {}),
        ...(values.cardName ? { cardName: values.cardName } : {}),
      };
    case AccountTypes.Goal:
      return { targetAmount: parseFloat(values.targetAmount) || 0 };
    case AccountTypes.Investment:
      return { deposited: parseFloat(values.deposited) || 0 };
    case AccountTypes.Loan:
      return {
        principal: parseFloat(values.principal) || 0,
        interestRate: parseFloat(values.interestRate) || 0,
        termMonths: parseInt(values.termMonths) || 0,
        startDate: values.loanStartDate || new Date().toISOString().slice(0, 10),
        ...(values.linkedItemName ? { linkedItemName: values.linkedItemName } : {}),
      };
    case AccountTypes.BorrowedLent:
      return {
        counterpartyName: values.counterpartyName,
        direction: values.direction,
        ...(values.dueDate ? { dueDate: values.dueDate } : {}),
        settled: false,
      };
    default:
      return null;
  }
}

// --- Edit Account ---

export const EditAccountSchema = AddAccountSchema.omit({ openingBalance: true, type: true });
export type EditAccountValues = z.infer<typeof EditAccountSchema>;

export function accountToEditValues(acc: {
  name: string;
  description?: string | null;
  type: string;
  creditLimit?: number;
  statementDay?: number;
  cardLastFour?: string;
  cardName?: string;
  targetAmount?: number;
  deposited?: number;
  principal?: number;
  interestRate?: number;
  termMonths?: number;
  startDate?: string;
  linkedItemName?: string;
  counterpartyName?: string;
  direction?: string;
  dueDate?: string;
}): EditAccountValues {
  return {
    name: acc.name,
    description: acc.description ?? '',
    creditLimit: String(acc.creditLimit ?? ''),
    statementDay: String(acc.statementDay ?? ''),
    cardLastFour: acc.cardLastFour ?? '',
    cardName: acc.cardName ?? '',
    bankCardLastFour: acc.type === AccountTypes.Bank ? (acc.cardLastFour ?? '') : '',
    bankCardName: acc.type === AccountTypes.Bank ? (acc.cardName ?? '') : '',
    targetAmount: String(acc.targetAmount ?? ''),
    deposited: String(acc.deposited ?? '0'),
    principal: String(acc.principal ?? ''),
    interestRate: String(acc.interestRate ?? ''),
    termMonths: String(acc.termMonths ?? ''),
    loanStartDate: acc.startDate ?? '',
    linkedItemName: acc.linkedItemName ?? '',
    counterpartyName: acc.counterpartyName ?? '',
    direction: acc.direction ?? LentDirections.Gave,
    dueDate: acc.dueDate ?? '',
  };
}

export function formToEditDetails(
  type: string,
  values: EditAccountValues,
  preserved: { settled?: boolean } = {},
): object | null {
  switch (type) {
    case AccountTypes.Bank:
      return {
        ...(values.bankCardLastFour ? { cardLastFour: values.bankCardLastFour } : {}),
        ...(values.bankCardName ? { cardName: values.bankCardName } : {}),
      };
    case AccountTypes.CreditCard:
      return {
        creditLimit: parseFloat(values.creditLimit) || 0,
        statementDay: parseInt(values.statementDay) || 1,
        ...(values.cardLastFour ? { cardLastFour: values.cardLastFour } : {}),
        ...(values.cardName ? { cardName: values.cardName } : {}),
      };
    case AccountTypes.Goal:
      return { targetAmount: parseFloat(values.targetAmount) || 0 };
    case AccountTypes.Investment:
      return { deposited: parseFloat(values.deposited) || 0 };
    case AccountTypes.Loan:
      return {
        principal: parseFloat(values.principal) || 0,
        interestRate: parseFloat(values.interestRate) || 0,
        termMonths: parseInt(values.termMonths) || 0,
        startDate: values.loanStartDate || new Date().toISOString().slice(0, 10),
        ...(values.linkedItemName ? { linkedItemName: values.linkedItemName } : {}),
      };
    case AccountTypes.BorrowedLent:
      return {
        counterpartyName: values.counterpartyName,
        direction: values.direction,
        ...(values.dueDate ? { dueDate: values.dueDate } : {}),
        settled: preserved.settled ?? false,
      };
    default:
      return null;
  }
}

// --- Create Budget ---

export const CreateBudgetSchema = z.object({
  name: z.string().trim().min(1, 'Budget name is required'),
  defaultCurrency: z.enum(SupportedCurrencies),
});

export type CreateBudgetValues = z.infer<typeof CreateBudgetSchema>;

export const defaultCreateBudgetValues: CreateBudgetValues = {
  name: '',
  defaultCurrency: 'EUR',
};

// --- Budget Settings ---

export const BudgetSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Budget name is required'),
  defaultCurrency: z.enum(SupportedCurrencies),
});

export type BudgetSettingsValues = z.infer<typeof BudgetSettingsSchema>;

// --- Add Plan Item ---

export const AddPlanItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(v => !isNaN(parseFloat(v)), 'Must be a number'),
  currency: z.string(),
  linkedAccountId: z.string(),
  categoryId: z.string(),
});

export type AddPlanItemValues = z.infer<typeof AddPlanItemSchema>;

// --- Edit Plan Item ---

export const EditPlanItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Must be a positive number'),
  currency: z.enum(SupportedCurrencies),
  linkedAccountId: z.string(),
  categoryId: z.string(),
  assignedAmount: z.string(),
});

export type EditPlanItemValues = z.infer<typeof EditPlanItemSchema>;

export function planItemToEditValues(
  item: {
    name: string;
    amount: number;
    currency: string;
    linkedAccountId: number | null;
    categoryId: number | null;
    assignedAmount: number;
  },
  fallbackCurrency: string,
): EditPlanItemValues {
  const currency = SupportedCurrencies.includes(item.currency as (typeof SupportedCurrencies)[number])
    ? (item.currency as (typeof SupportedCurrencies)[number])
    : (fallbackCurrency as (typeof SupportedCurrencies)[number]);
  return {
    name: item.name,
    amount: String(item.amount),
    currency,
    linkedAccountId: item.linkedAccountId != null ? String(item.linkedAccountId) : '',
    categoryId: item.categoryId != null ? String(item.categoryId) : '',
    assignedAmount: String(item.assignedAmount),
  };
}

export function formToEditPlanItem(values: EditPlanItemValues) {
  return {
    name: values.name.trim(),
    amount: parseFloat(values.amount),
    currency: values.currency,
    linkedAccountId: values.linkedAccountId ? parseInt(values.linkedAccountId, 10) : null,
    categoryId: values.categoryId ? parseInt(values.categoryId, 10) : null,
    assignedAmount: parseFloat(values.assignedAmount) || 0,
  };
}

// --- Add Transaction ---

export const AddTransactionSchema = z.object({
  txType: z.enum(TransactionTypes),
  payee: z.string(),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string().min(1),
  note: z.string(),
});

export type AddTransactionValues = z.infer<typeof AddTransactionSchema>;

export const defaultAddTransactionValues: AddTransactionValues = {
  txType: TransactionTypes.Expense,
  payee: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
};
