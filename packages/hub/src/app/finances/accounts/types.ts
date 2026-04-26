export interface AccountItem {
  id: number;
  name: string;
  type: string;
  currency: string;
  balance: number;
  archived: boolean;
  // Credit card
  creditLimit?: number;
  statementDay?: number;
  cardLastFour?: string;
  cardName?: string;
  // Goal
  targetAmount?: number;
  // Investment
  deposited?: number;
  // Loan
  principal?: number;
  interestRate?: number;
  termMonths?: number;
  startDate?: string;
  linkedItemName?: string;
  // Borrowed/lent
  counterpartyName?: string;
  direction?: string;
  dueDate?: string;
  settled?: boolean;
}

export interface AccountsListData {
  currency: string;
  netWorth: number;
  netWorthHistory: number[];
  accounts: AccountItem[];
}

export interface AccountTransaction {
  id: number;
  date: string;
  amount: number;
  type: string;
  notes: string | null;
  merchantName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  balanceAfter: number | null;
  isCorrection: boolean;
}

export interface AccountDetailData {
  account: AccountItem;
  transactions: AccountTransaction[];
}
