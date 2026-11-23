import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface ProfileSnapshot {
  profile: {
    goalMinCalories?: number | null;
    goalMaxCalories?: number | null;
    gymDays?: number[] | null;
  };
}

/** The part of a history day and of a daily summary this suite reads. */
interface DayWithTarget {
  date: string;
  dayTarget: number | null;
}

interface HistoryPeriod {
  days: DayWithTarget[];
}

/** YYYY-MM-DD `n` days before UTC's today — far enough back to be over in every timezone. */
function utcDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * A finished day keeps the calorie range it had: changing the profile moves today's target but
 * not a past day's, in the history and in that day's summary alike.
 *
 * Ranges freeze at profile changes, for finished days with meals. Frozen ranges persist for the
 * test user across runs, so the past day's range is read first and the profile is then moved away
 * from it, rather than assuming what it was.
 */
describe('calories — finished days keep their target', () => {
  let client: McpClient;
  let saved: ProfileSnapshot['profile'] = {};
  let mealId: string | undefined;
  const pastDay = utcDaysAgo(10);

  const history = async () =>
    parseToolResult<HistoryPeriod>(
      await client.callTool({ name: 'calories_get_history', arguments: { startDate: pastDay } }),
    ).days;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/calories/mcp', token);
    saved = parseToolResult<ProfileSnapshot>(
      await client.callTool({ name: 'calories_get_profile', arguments: {} }),
    ).profile;
  });

  afterAll(async () => {
    try {
      if (mealId) await client.callTool({ name: 'calories_delete_meal', arguments: { mealId } });
      await client.callTool({
        name: 'calories_update_profile',
        arguments: {
          goalMinCalories: saved.goalMinCalories ?? null,
          goalMaxCalories: saved.goalMaxCalories ?? null,
          gymDays: saved.gymDays ?? null,
        },
      });
    } catch {
      // best-effort cleanup — never fail the run on it
    }
    await client.close();
  });

  it("moves today's target with the profile and leaves a finished day's alone", async () => {
    // ── 1. A meal on the past day: profile changes freeze days that have meals ──
    const { meals } = parseToolResult<{ meals: { mealId: string }[] }>(
      await client.callTool({
        name: 'calories_log_meal',
        arguments: { description: 'Frozen-day check', calories: 500, mealType: 'lunch', date: pastDay },
      }),
    );
    mealId = meals[0]!.mealId;

    // ── 2. A plain profile, no gym days, so a live day's target is just the max ──
    await client.callTool({
      name: 'calories_update_profile',
      arguments: { goalMinCalories: null, goalMaxCalories: 2000, gymDays: null },
    });

    // ── 3. Whatever the past day reads now (frozen by an earlier run, or live) ──
    const before = await history();
    expect(before[0]!.date).toBe(pastDay);
    const pastTarget = before[0]!.dayTarget;

    // ── 4. Move the max away from it — this update freezes the past day first ──
    const newMax = (pastTarget ?? 2000) + 137;
    await client.callTool({ name: 'calories_update_profile', arguments: { goalMaxCalories: newMax } });

    // ── 5. Today follows the profile; the finished day doesn't ─────────────────
    const after = await history();
    expect(after[0]!.dayTarget).toBe(pastTarget);
    expect(after.at(-1)!.dayTarget).toBe(newMax);

    const summary = parseToolResult<DayWithTarget>(
      await client.callTool({ name: 'calories_get_daily_summary', arguments: { date: pastDay } }),
    );
    expect(summary.dayTarget).toBe(pastTarget);
  });
});
