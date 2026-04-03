import {
  getSubscribedUserIds,
  sendEmail,
  buildMonthlyReportHtml,
  fetchMonthlyReportData,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { getLastMonthStart, monthLabel, toUTCDateStr } from '@my-hub/shared/utils';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

export async function sendCaloriesMonthlyReports(): Promise<void> {
  const monthStart = getLastMonthStart();
  const userIds = await getSubscribedUserIds('calories_monthly_report');

  const currentMonthLabel = monthLabel(monthStart);
  console.log(`[calories-monthly-report] Sending to ${userIds.length} user(s) for ${currentMonthLabel}`);

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const monthStartStr = toUTCDateStr(monthStart);
      const urls = {
        unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(userId, 'calories_monthly_report')}`,
        viewInAppUrl: `${HUB_URL}/calories/reports/monthly?monthStart=${monthStartStr}`,
      };
      const data = await fetchMonthlyReportData(userId, monthStart, urls);
      if (!data || data.userEmail !== 'a.alex.alexiuc@gmail.com') {
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
      console.error(`[calories-monthly-report] Failed for user ${userId}:`, err);
    }
  }

  console.log(`[calories-monthly-report] Done — sent: ${sent}, skipped (no data): ${skipped}`);
}
