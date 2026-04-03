import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import {
  fetchMonthlyReportCaloriesData,
  buildMonthlyReportHtml,
  generateUnsubscribeToken,
} from '@my-hub/shared/services';

const HUB_URL = process.env.HUB_URL ?? 'https://hub.alexiuc.dev';

/**
 * GET /api/calories/reports/monthly-preview?monthStart=YYYY-MM-DD
 * Returns the rendered monthly report HTML for the authenticated user.
 */
export const GET = withAuth(async ({ req, user }) => {
  const url = new URL(req.url);
  const monthStartParam = url.searchParams.get('monthStart');

  let monthStart: Date;
  if (monthStartParam && /^\d{4}-\d{2}-\d{2}$/.test(monthStartParam)) {
    monthStart = new Date(`${monthStartParam}T00:00:00Z`);
  } else {
    // Default: first day of previous month
    const now = new Date();
    monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  }

  const monthStartStr = monthStart.toISOString().slice(0, 10);
  const urls = {
    unsubscribeUrl: `${HUB_URL}/api/unsubscribe?token=${generateUnsubscribeToken(user.id, 'calories_monthly_report')}`,
    viewInAppUrl: `${HUB_URL}/calories/reports/monthly?monthStart=${monthStartStr}`,
  };

  const data = await fetchMonthlyReportCaloriesData(user.id, monthStart, urls);
  if (!data) {
    return NextResponse.json({ skipped: 'no_data' });
  }

  return NextResponse.json({ html: buildMonthlyReportHtml(data, { hideFooter: true }) });
});
