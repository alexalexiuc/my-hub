import {
  getSubscribedUserIds,
  sendEmail,
  buildWeeklyReportHtml,
  fetchWeeklyReportCaloriesData,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { getLastMonday, toUTCDateStr, logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env';

export async function sendCaloriesWeeklyReports(): Promise<void> {
  const weekStart = getLastMonday();
  const weekStartStr = toUTCDateStr(weekStart);
  const userIds = await getSubscribedUserIds('calories_weekly_report');

  logger.info(`[calories-weekly-report] Sending to ${userIds.length} user(s) for week starting ${weekStartStr}`);

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      logger.info(`[calories-weekly-report] Processing user ${userId}...`);

      const data = await fetchWeeklyReportCaloriesData(userId, weekStart);
      if (!data) {
        skipped++;
        continue;
      }

      const urls = {
        unsubscribeUrl: `${workerEnvConfig.HUB_URL}/api/unsubscribe?token=${await generateUnsubscribeToken(userId, 'calories_weekly_report')}`,
        viewInAppUrl: `${workerEnvConfig.HUB_URL}/calories/reports/weekly?weekStart=${weekStartStr}`,
      };
      const html = buildWeeklyReportHtml({ ...data, urls });
      await sendEmail({
        to: data.userEmail,
        subject: `Weekly Calories Report — Week ${data.weekNumber}, ${data.year}`,
        html,
      });
      sent++;
    } catch (err) {
      logger.error(`[calories-weekly-report] Failed for user ${userId}:`, err);
    }
  }

  logger.info(`[calories-weekly-report] Done — sent: ${sent}, skipped (no data): ${skipped}`);
}
