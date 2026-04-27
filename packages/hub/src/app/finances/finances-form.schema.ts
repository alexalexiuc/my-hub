import { z } from 'zod';
import { AccountTypes, LentDirections } from '@my-hub/shared/constants';

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

// --- Add Account ---

export const AddAccountSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
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

// --- Create Budget ---

export const CreateBudgetSchema = z.object({
  name: z.string().trim().min(1, 'Budget name is required'),
  defaultCurrency: z.string().min(1),
});

export type CreateBudgetValues = z.infer<typeof CreateBudgetSchema>;

export const defaultCreateBudgetValues: CreateBudgetValues = {
  name: '',
  defaultCurrency: 'EUR',
};

// --- Budget Settings ---

export const BudgetSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Budget name is required'),
  defaultCurrency: z.string().min(1),
});

export type BudgetSettingsValues = z.infer<typeof BudgetSettingsSchema>;

// --- Add Transaction ---

export const AddTransactionSchema = z.object({
  txType: z.enum(['expense', 'income', 'transfer']),
  payee: z.string(),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string().min(1),
  note: z.string(),
});

export type AddTransactionValues = z.infer<typeof AddTransactionSchema>;

export const defaultAddTransactionValues: AddTransactionValues = {
  txType: 'expense',
  payee: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  note: '',
};
