import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { fetchWeeklyReportData, buildWeeklyReportHtml, generateUnsubscribeToken } from '@my-hub/shared/services';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

/**
 * GET /api/calories/reports/weekly-preview?weekStart=YYYY-MM-DD
 * Returns the rendered weekly report HTML for the authenticated user.
 */
export const GET = withAuth(async ({ req, user }) => {
  const url = new URL(req.url);
  const weekStartParam = url.searchParams.get('weekStart');

  let weekStart: Date;
  if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    weekStart = new Date(`${weekStartParam}T00:00:00Z`);
  } else {
    // Default: last Monday
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayOfWeek = todayUtc.getUTCDay();
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    todayUtc.setUTCDate(todayUtc.getUTCDate() - daysSinceMonday - 7);
    weekStart = todayUtc;
  }

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const urls = {
    unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(user.id, 'calories_weekly_report')}`,
    viewInAppUrl: `${HUB_URL}/calories/reports/weekly?weekStart=${weekStartStr}`,
  };

  const data = await fetchWeeklyReportData(user.id, weekStart, urls);
  if (!data) {
    return NextResponse.json({ skipped: 'no_data' });
  }

  return NextResponse.json({ html: buildWeeklyReportHtml(data, { hideFooter: true }) });
});
