import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  fetchWeeklyReportData,
  buildWeeklyReportHtml,
  sendEmail,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

function getLastMonday(): Date {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = todayUtc.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  todayUtc.setUTCDate(todayUtc.getUTCDate() - daysSinceMonday - 7);
  return todayUtc;
}

/**
 * POST /api/calories/reports/weekly-trigger
 * Manually sends the weekly report for the authenticated user (for testing).
 */
export const POST = withAuth(async ({ user }) => {
  const weekStart = getLastMonday();
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const urls = {
    unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(user.id, 'calories_weekly_report')}`,
    viewInAppUrl: `${HUB_URL}/calories/reports/weekly?weekStart=${weekStartStr}`,
  };

  const data = await fetchWeeklyReportData(user.id, weekStart, urls);
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
