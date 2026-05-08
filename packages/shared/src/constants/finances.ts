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

export const SupportedCurrencies = ['EUR', 'USD', 'GBP', 'MDL', 'RON', 'UAH', 'CHF', 'JPY', 'CAD', 'AUD'] as const;
export type SupportedCurrency = (typeof SupportedCurrencies)[number];

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
  // Personal & lifestyle
  Dumbbell: 'dumbbell',
  PawPrint: 'paw_print',
  Baby: 'baby',
  Scissors: 'scissors',
  // Finance & obligations
  Receipt: 'receipt',
  Fuel: 'fuel',
  Shield: 'shield',
  Landmark: 'landmark',
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

// ---- Account type metadata ----

/** Human-readable description shown in the Add Account form. */
export const ACCOUNT_TYPE_DESCRIPTIONS: Record<AccountType, string> = {
  [AccountTypes.Bank]: 'Checking or savings account at a bank. Tracks day-to-day spending and deposits.',
  [AccountTypes.Cash]: 'Physical cash you hold. Great for tracking wallet or petty-cash balances.',
  [AccountTypes.CreditCard]: 'Credit card with a revolving limit. Tracks statement balance and available credit.',
  [AccountTypes.Investment]: 'Brokerage, pension, or crypto portfolio. Tracks current value vs. amount deposited.',
  [AccountTypes.Loan]:
    'Mortgage, car loan, or instalment plan. Tracks remaining principal and generates a repayment schedule.',
  [AccountTypes.Goal]: 'Savings pot with a target amount. Progress bar shows how close you are to your goal.',
  [AccountTypes.Tracking]: 'Read-only account for assets you want to include in net worth (e.g. a car or property).',
  [AccountTypes.BorrowedLent]: 'Tracks money you lent to or borrowed from someone, with optional due date.',
};

/**
 * Account types that can be selected as the source account for expense or income transactions.
 * Investment, Loan, Goal, and BorrowedLent accounts are excluded because they represent
 * non-transactional balances — money flows in/out via transfers, not direct expense/income entries.
 */
export const EXPENSE_ACCOUNT_TYPES = new Set<AccountType>([
  AccountTypes.Bank,
  AccountTypes.Cash,
  AccountTypes.CreditCard,
]);

export const TransactionSources = {
  hub: 'hub',
  mcp: 'mcp',
  automation: 'automation',
  import: 'import',
} as const;
export type TransactionSource = (typeof TransactionSources)[keyof typeof TransactionSources];
export const transactionSourceValues = Object.values(TransactionSources) as TransactionSource[];
