import {
  getSubscribedUserIds,
  sendEmail,
  buildWeeklyReportHtml,
  fetchWeeklyReportData,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

/** Returns the Monday of the previous week (UTC) at 00:00:00. */
function getLastMonday(): Date {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = todayUtc.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  todayUtc.setUTCDate(todayUtc.getUTCDate() - daysSinceMonday - 7);
  return todayUtc;
}

export async function sendCaloriesWeeklyReports(): Promise<void> {
  const weekStart = getLastMonday();
  const userIds = await getSubscribedUserIds('calories_weekly_report');

  console.log(
    `[calories-weekly-report] Sending to ${userIds.length} user(s) for week starting ${weekStart.toISOString().slice(0, 10)}`,
  );

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const urls = {
        unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(userId, 'calories_weekly_report')}`,
        viewInAppUrl: `${HUB_URL}/calories/reports/weekly?weekStart=${weekStartStr}`,
      };
      const data = await fetchWeeklyReportData(userId, weekStart, urls);
      if (!data || data.userEmail !== 'a.alex.alexiuc@gmail.com') {
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
