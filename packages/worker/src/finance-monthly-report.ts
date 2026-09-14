import {
  getSubscribedUserIds,
  getUserActiveBudget,
  getBudgetById,
  getMonthlyFinanceReport,
  findUserById,
  sendEmail,
  buildFinanceMonthlyReportHtml,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { formatMonthStr, logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env';

export async function sendFinanceMonthlyReports(): Promise<void> {
  const userIds = await getSubscribedUserIds('finance_monthly_report');
  logger.info(`[finance-monthly-report] Sending to ${userIds.length} user(s)`);

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
        getMonthlyFinanceReport(userId, budget.id),
        getBudgetById(userId, budget.id),
      ]);

      const monthLabelStr = formatMonthStr(report.month);
      const urls = {
        unsubscribeUrl: `${workerEnvConfig.HUB_URL}/api/unsubscribe?token=${await generateUnsubscribeToken(userId, 'finance_monthly_report')}`,
        viewInAppUrl: `${workerEnvConfig.HUB_URL}/finances/reports/monthly?month=${report.month}`,
      };
      const html = buildFinanceMonthlyReportHtml({
        report,
        monthLabel: monthLabelStr,
        currency: budgetInfo?.defaultCurrency ?? 'EUR',
        urls,
      });

      await sendEmail({ to: user.email, subject: `Monthly Finance Report — ${monthLabelStr}`, html });
      sent++;
    } catch (err) {
      logger.error(`[finance-monthly-report] Failed for user ${userId}:`, err);
    }
  }

  logger.info(`[finance-monthly-report] Done — sent: ${sent}, skipped: ${skipped}`);
}
