import { z } from 'zod';
import { route } from '@/lib/api/route';
import { fetchMonthlyReportCaloriesData, buildMonthlyReportHtml } from '@my-hub/shared/services';

/**
 * GET /api/calories/reports/monthly-preview?monthStart=YYYY-MM-DD
 * Returns the rendered monthly report HTML for the authenticated user.
 */
export const GET = route({ query: z.object({ monthStart: z.string().optional() }) })(async ({ user, query }) => {
  const monthStartParam = query.monthStart;

  let monthStart: Date;
  if (monthStartParam && /^\d{4}-\d{2}-\d{2}$/.test(monthStartParam)) {
    monthStart = new Date(`${monthStartParam}T00:00:00Z`);
  } else {
    // Default: first day of previous month
    const now = new Date();
    monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  }

  const data = await fetchMonthlyReportCaloriesData(user.id, monthStart);
  if (!data) {
    return { skipped: 'no_data' };
  }

  return { html: buildMonthlyReportHtml(data) };
});
