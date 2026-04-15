import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  fetchMonthlyReportCaloriesData,
  buildMonthlyReportHtml,
  sendEmail,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { getLastMonthStart, toUTCDateStr } from '@my-hub/shared/utils';
import { hubEnvConfig } from '@/config/env';

/**
 * POST /api/calories/reports/monthly-trigger
 * Manually sends the monthly report for the authenticated user (for testing).
 */
export const POST = withAuth(async ({ user }) => {
  const monthStart = getLastMonthStart();
  const monthStartStr = toUTCDateStr(monthStart);
  const urls = {
    unsubscribeUrl: `${hubEnvConfig.HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(user.id, 'calories_monthly_report')}`,
    viewInAppUrl: `${hubEnvConfig.HUB_URL}/calories/reports/monthly?monthStart=${monthStartStr}`,
  };

  const data = await fetchMonthlyReportCaloriesData(user.id, monthStart, urls);
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
