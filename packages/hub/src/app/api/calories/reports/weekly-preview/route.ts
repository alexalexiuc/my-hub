import { z } from 'zod';
import { route } from '@/lib/api/route';
import { fetchWeeklyReportCaloriesData, buildWeeklyReportHtml } from '@my-hub/shared/services';

/**
 * GET /api/calories/reports/weekly-preview?weekStart=YYYY-MM-DD
 * Returns the rendered weekly report HTML for the authenticated user.
 */
export const GET = route({ query: z.object({ weekStart: z.string().optional() }) })(async ({ user, query }) => {
  const weekStartParam = query.weekStart;

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

  const data = await fetchWeeklyReportCaloriesData(user.id, weekStart);
  if (!data) {
    return { skipped: 'no_data' };
  }

  return { html: buildWeeklyReportHtml(data) };
});
