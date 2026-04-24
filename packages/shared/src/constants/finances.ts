export const AccountTypes = {
  Cash: 'cash',
  Bank: 'bank',
  Investment: 'investment',
  Tracking: 'tracking',
  BorrowedLent: 'borrowed_lent',
  Loan: 'loan',
  CreditCard: 'credit_card',
  Goal: 'goal',
} as const;
export type AccountType = (typeof AccountTypes)[keyof typeof AccountTypes];

export const TransactionTypes = {
  Expense: 'expense',
  Income: 'income',
  Transfer: 'transfer',
} as const;
export type TransactionType = (typeof TransactionTypes)[keyof typeof TransactionTypes];

export const LentDirections = {
  Gave: 'gave',
  Received: 'received',
} as const;
export type LentDirection = (typeof LentDirections)[keyof typeof LentDirections];

// Category icons — mapped to UI components (e.g. Lucide icons) by the frontend.
// Add new values here first; the frontend mapping lives in the Hub package.
export const CategoryIcons = {
  // Food & drink
  ShoppingCart: 'shopping_cart',
  UtensilsCrossed: 'utensils_crossed',
  Coffee: 'coffee',
  // Transport
  Car: 'car',
  Bus: 'bus',
  Plane: 'plane',
  Motorbike: 'motorbike',
  // Home & utilities
  Home: 'home',
  Zap: 'zap', // electricity / utilities
  Wifi: 'wifi',
  // Health
  Heart: 'heart',
  Pill: 'pill',
  // Entertainment & lifestyle
  Tv: 'tv',
  Music: 'music',
  Gamepad2: 'gamepad2',
  // Finance
  Banknote: 'banknote',
  TrendingUp: 'trending_up',
  CreditCard: 'credit_card',
  // Shopping
  ShoppingBag: 'shopping_bag',
  Gift: 'gift',
  // Education & work
  BookOpen: 'book_open',
  Briefcase: 'briefcase',
  // Misc
  Tag: 'tag',
  MoreHorizontal: 'more_horizontal',
} as const;
export type CategoryIcon = (typeof CategoryIcons)[keyof typeof CategoryIcons];

// ---- Type-specific JSONB detail interfaces (financeAccounts.details) ----

export interface BankAccountDetails {
  interestRate?: number;
  savingsGoal?: number;
  cardLastFour?: string;
  cardName?: string;
}

export interface InvestmentAccountDetails {
  deposited: number; // sum of transfers in; updated on each inbound transfer
}

export interface BorrowedLentAccountDetails {
  counterpartyName: string;
  direction: LentDirection;
  dueDate?: string; // YYYY-MM-DD
  settled: boolean;
}

export interface LoanAccountDetails {
  principal: number;
  interestRate: number; // 0 for installment plans
  termMonths: number;
  linkedItemName?: string;
  startDate: string; // YYYY-MM-DD
}

export interface CreditCardAccountDetails {
  creditLimit: number;
  statementDay: number; // day of month (1–31)
  cardLastFour?: string;
  cardName?: string;
}

export interface CashAccountDetails {
  savingsTarget?: number;
}

export interface GoalAccountDetails {
  targetAmount: number;
}
