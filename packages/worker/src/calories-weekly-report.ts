import {
  getSubscribedUserIds,
  sendEmail,
  buildWeeklyReportHtml,
  fetchWeeklyReportCaloriesData,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { getLastMonday, toUTCDateStr } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env';

export async function sendCaloriesWeeklyReports(): Promise<void> {
  const weekStart = getLastMonday();
  const userIds = await getSubscribedUserIds('calories_weekly_report');

  console.log(
    `[calories-weekly-report] Sending to ${userIds.length} user(s) for week starting ${toUTCDateStr(weekStart)}`,
  );

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      console.log(`[calories-weekly-report] Processing user ${userId}...`);
      const weekStartStr = toUTCDateStr(weekStart);
      const urls = {
        unsubscribeUrl: `${workerEnvConfig.HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(userId, 'calories_weekly_report')}`,
        viewInAppUrl: `${workerEnvConfig.HUB_URL}/calories/reports/weekly?weekStart=${weekStartStr}`,
      };
      const data = await fetchWeeklyReportCaloriesData(userId, weekStart, urls);
      if (!data) {
        skipped++;
        continue;
      }

      const html = buildWeeklyReportHtml(data);
      await sendEmail({
        to: data.userEmail,
        subject: `Weekly Calories Report — Week ${data.weekNumber}, ${data.year}`,
        html,
      });
      sent++;
    } catch (err) {
      console.error(`[calories-weekly-report] Failed for user ${userId}:`, err);
    }
  }

  console.log(`[calories-weekly-report] Done — sent: ${sent}, skipped (no data): ${skipped}`);
}
