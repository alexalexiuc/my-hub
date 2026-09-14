import type { YearlyFinanceReport } from '../../../finances/reports';

export interface FinanceYearlyReportData {
  report: YearlyFinanceReport;
  currency: string;
  userEmail: string;
}

export type BuildFinanceYearlyReportHtmlData = Omit<FinanceYearlyReportData, 'userEmail'> & {
  urls?: {
    unsubscribeUrl: string;
    viewInAppUrl: string;
  };
};
