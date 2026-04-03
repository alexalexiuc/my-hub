import {
  getSubscribedUserIds,
  sendEmail,
  buildMonthlyReportHtml,
  fetchMonthlyReportData,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

/** Returns the first day of the previous calendar month (UTC). */
function getLastMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

export async function sendCaloriesMonthlyReports(): Promise<void> {
  const monthStart = getLastMonthStart();
  const userIds = await getSubscribedUserIds('calories_monthly_report');

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  console.log(`[calories-monthly-report] Sending to ${userIds.length} user(s) for ${monthLabel}`);

  let sent = 0;
  let skipped = 0;

  for (const userId of userIds) {
    try {
      const monthStartStr = monthStart.toISOString().slice(0, 10);
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
