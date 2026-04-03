import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  fetchWeeklyReportCaloriesData,
  buildWeeklyReportHtml,
  sendEmail,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';
import { getLastMonday, toUTCDateStr } from '@my-hub/shared/utils';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

/**
 * POST /api/calories/reports/weekly-trigger
 * Manually sends the weekly report for the authenticated user (for testing).
 */
export const POST = withAuth(async ({ user }) => {
  const weekStart = getLastMonday();
  const weekStartStr = toUTCDateStr(weekStart);
  const urls = {
    unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(user.id, 'calories_weekly_report')}`,
    viewInAppUrl: `${HUB_URL}/calories/reports/weekly?weekStart=${weekStartStr}`,
  };

  const data = await fetchWeeklyReportCaloriesData(user.id, weekStart, urls);
  if (!data) {
    return NextResponse.json({ skipped: 'no_data' });
  }

  const html = buildWeeklyReportHtml(data);
  await sendEmail({
    to: user.email,
    subject: `[Test] Weekly Calories Report — Week ${data.weekNumber}, ${data.year}`,
    html,
  });

  return NextResponse.json({ sent: true });
});
