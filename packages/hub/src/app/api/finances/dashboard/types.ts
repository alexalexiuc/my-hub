export interface DashboardCategory {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  spent: number;
  target: number;
}

export interface DashboardGoal {
  id: number;
  name: string;
  balance: number;
  target: number;
}

export interface DashboardTransaction {
  id: number;
  date: string;
  amount: number;
  type: string;
  notes: string | null;
  merchantName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
}

export interface FinanceDashboardData {
  hasBudget: true;
  budgetId: number;
  budgetName: string;
  currency: string;
  netWorth: number;
  netWorthHistory: number[];
  monthlyIncome: number;
  monthlyExpense: number;
  categories: DashboardCategory[];
  goals: DashboardGoal[];
  recentTransactions: DashboardTransaction[];
}

export interface NoBudgetResponse {
  hasBudget: false;
}

export type DashboardResponse = FinanceDashboardData | NoBudgetResponse;
