import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  fetchMonthlyReportData,
  buildMonthlyReportHtml,
  sendEmail,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

function getLastMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
}

/**
 * POST /api/calories/reports/monthly-trigger
 * Manually sends the monthly report for the authenticated user (for testing).
 */
export const POST = withAuth(async ({ user }) => {
  const monthStart = getLastMonthStart();
  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const urls = {
    unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(user.id, 'calories_monthly_report')}`,
    viewInAppUrl: `${HUB_URL}/calories/reports/monthly?monthStart=${monthStartStr}`,
  };

  const data = await fetchMonthlyReportData(user.id, monthStart, urls);
  if (!data) {
    return NextResponse.json({ skipped: 'no_data' });
  }

  const html = buildMonthlyReportHtml(data);
  await sendEmail({
    to: user.email,
    subject: `[Test] Monthly Calories Report — ${data.monthLabel}`,
    html,
  });

  return NextResponse.json({ sent: true });
});
