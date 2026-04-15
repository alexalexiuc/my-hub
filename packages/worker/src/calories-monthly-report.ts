import {
  getSubscribedUserIds,
  sendEmail,
  buildMonthlyReportHtml,
  fetchMonthlyReportCaloriesData,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { getLastMonthStart, monthLabel, toUTCDateStr, logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env';

export async function sendCaloriesMonthlyReports(): Promise<void> {
  const monthStart = getLastMonthStart();
  const userIds = await getSubscribedUserIds('calories_monthly_report');

  const currentMonthLabel = monthLabel(monthStart);
  logger.info(`[calories-monthly-report] Sending to ${userIds.length} user(s) for ${currentMonthLabel}`);

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const monthStartStr = toUTCDateStr(monthStart);
      const urls = {
        unsubscribeUrl: `${workerEnvConfig.HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(userId, 'calories_monthly_report')}`,
        viewInAppUrl: `${workerEnvConfig.HUB_URL}/calories/reports/monthly?monthStart=${monthStartStr}`,
      };
      const data = await fetchMonthlyReportCaloriesData(userId, monthStart, urls);
      if (!data) {
        skipped++;
        continue;
      }

      const html = buildMonthlyReportHtml(data);
      await sendEmail({
        to: data.userEmail,
        subject: `Monthly Calories Report — ${data.monthLabel}`,
        html,
      });
      sent++;
    } catch (err) {
      logger.error(`[calories-monthly-report] Failed for user ${userId}:`, err);
    }
  }

  logger.info(`[calories-monthly-report] Done — sent: ${sent}, skipped (no data): ${skipped}`);
}
