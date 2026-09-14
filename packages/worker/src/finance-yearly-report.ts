import {
  getSubscribedUserIds,
  getUserActiveBudget,
  getBudgetById,
  getYearlyFinanceReport,
  findUserById,
  sendEmail,
  buildFinanceYearlyReportHtml,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env';

export async function sendFinanceYearlyReports(): Promise<void> {
  const userIds = await getSubscribedUserIds('finance_yearly_report');
  logger.info(`[finance-yearly-report] Sending to ${userIds.length} user(s)`);

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const [user, budget] = await Promise.all([findUserById(userId), getUserActiveBudget(userId)]);
      if (!user || !budget) {
        skipped++;
        continue;
      }

      const [report, budgetInfo] = await Promise.all([
        getYearlyFinanceReport(userId, budget.id),
        getBudgetById(userId, budget.id),
      ]);

      const urls = {
        unsubscribeUrl: `${workerEnvConfig.HUB_URL}/api/unsubscribe?token=${await generateUnsubscribeToken(userId, 'finance_yearly_report')}`,
        viewInAppUrl: `${workerEnvConfig.HUB_URL}/finances/reports/yearly?year=${report.year}`,
      };
      const html = buildFinanceYearlyReportHtml({ report, currency: budgetInfo?.defaultCurrency ?? 'EUR', urls });

      await sendEmail({ to: user.email, subject: `Yearly Finance Report — ${report.year}`, html });
      sent++;
    } catch (err) {
      logger.error(`[finance-yearly-report] Failed for user ${userId}:`, err);
    }
  }

  logger.info(`[finance-yearly-report] Done — sent: ${sent}, skipped: ${skipped}`);
}
