import type { MonthlyFinanceReport } from '../../../finances/reports';

export interface FinanceMonthlyReportData {
  report: MonthlyFinanceReport;
  monthLabel: string; // e.g. "March 2026"
  currency: string;
  userEmail: string;
}

export type BuildFinanceMonthlyReportHtmlData = Omit<FinanceMonthlyReportData, 'userEmail'> & {
  urls?: {
    unsubscribeUrl: string;
    viewInAppUrl: string;
  };
};
