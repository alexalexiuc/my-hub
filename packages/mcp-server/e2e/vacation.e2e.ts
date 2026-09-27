import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface Config {
  ruleSets: { id: number; name: string }[];
  taxRegimes: { id: number; employer: string }[];
  leavePeriods: { id: number; notes: string | null }[];
}

interface Span {
  startDate: string;
  endDate: string;
  balanceCost: number;
  amountNet: number;
  deltaNet: number;
  restDays: number;
}

/**
 * E2e tests for the vacation MCP sub-server.
 *
 *   vacation_setup → vacation_estimate_leave_pay → vacation_plan_leave → vacation_find_best_windows
 *   → vacation_get_calendar → vacation_get_balance → (cleanup via vacation_setup / vacation_plan_leave)
 *
 * All data lives in 2099 and carries the run id, so it cannot collide with real data. The vacation
 * profile is per user, so the e2e user's profile is overwritten by each run.
 */
describe('vacation — setup, pricing and planning', () => {
  let client: McpClient;
  const runId = Date.now().toString(36);
  const tag = `[e2e:${runId}]`;
  const employer = `${tag} Employer`;
  const salaryMonths = ['2099-01', '2099-02', '2099-03', '2099-04'];

  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).toBeFalsy();
    return parseToolResult<T>(result);
  }

  /** Removes rule sets, tax regimes and leave left behind by this or an earlier interrupted run. */
  async function cleanup() {
    const config = await call<Config>('vacation_get_config', {});
    const leave = config.leavePeriods.filter(l => l.notes?.startsWith('[e2e:')).map(l => l.id);
    if (leave.length) await call('vacation_plan_leave', { remove: leave });
    await call('vacation_setup', {
      ruleSets: { remove: config.ruleSets.filter(r => r.name.startsWith('[e2e:')).map(r => r.id) },
      taxRegimes: { remove: config.taxRegimes.filter(t => t.employer.startsWith('[e2e:')).map(t => t.id) },
      salaries: { remove: salaryMonths },
      holidays: { remove: [{ date: '2099-05-01', country: 'MD' }] },
    });
  }

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/vacation/mcp', token);
    await call('vacation_setup', {
      profile: { country: 'MD', employer, openingBalanceDays: 10, openingBalanceDate: '2099-01-31' },
    });
    await cleanup();
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await client.close();
    }
  });

  it('vacation_setup writes the configuration in one call', async () => {
    const summary = await call<{ profile: string; salaries: { upserted: number } }>('vacation_setup', {
      ruleSets: {
        upsert: [
          {
            name: `${tag} MD calendar days`,
            country: 'MD',
            validFrom: '2099-01-01',
            leaveUnit: 'calendar',
            annualEntitlementDays: 28,
            rateBasis: 'calendar_day',
            status: 'active',
          },
        ],
      },
      taxRegimes: { upsert: [{ employer, regime: 'it_park', validFrom: '2099-01-01' }] },
      salaries: { upsert: salaryMonths.map(month => ({ month, baseMdl: 30000, kind: 'actual' })) },
      holidays: { upsert: [{ date: '2099-05-01', country: 'MD', kind: 'holiday', name: 'Labour Day' }] },
    });
    expect(summary.salaries.upserted).toBe(4);
  });

  it('vacation_setup rejects overlapping rule sets without writing anything', async () => {
    const result = await client.callTool({
      name: 'vacation_setup',
      arguments: {
        salaries: { upsert: [{ month: '2099-05', baseMdl: 1, kind: 'projected' }] },
        ruleSets: {
          upsert: [
            {
              name: `${tag} overlap`,
              country: 'MD',
              validFrom: '2099-03-01',
              leaveUnit: 'calendar',
              annualEntitlementDays: 28,
              rateBasis: 'calendar_day',
              status: 'active',
            },
          ],
        },
      },
    });
    expect(result.isError).toBe(true);
  });

  it('vacation_estimate_leave_pay prices a May leave from the Feb–Apr average', async () => {
    const data = await call<{ span: Span; rate: { calendarDayRate: number; windowMonths: string[] } }>(
      'vacation_estimate_leave_pay',
      { startDate: '2099-05-04', endDate: '2099-05-10' },
    );
    // No holidays in Feb–Apr 2099 and fully worked: rate = 3 × 30000 / (28 + 31 + 30) calendar days.
    expect(data.rate.windowMonths).toEqual(['2099-02', '2099-03', '2099-04']);
    expect(data.rate.calendarDayRate).toBeCloseTo(90000 / 89, 4);
    expect(data.span.balanceCost).toBe(7);
  });

  it('vacation_plan_leave records planned leave and reports the balance', async () => {
    const data = await call<{ upserted: number; balanceAfterLeave: { totalDays: number } | null }>(
      'vacation_plan_leave',
      { upsert: [{ startDate: '2099-06-01', endDate: '2099-06-05', status: 'planned', notes: tag }] },
    );
    expect(data.upserted).toBe(1);
    expect(data.balanceAfterLeave?.totalDays).toBeGreaterThan(0);
  });

  it('vacation_find_best_windows returns non-overlapping spans that each spend the requested days', async () => {
    const data = await call<{ windows: Span[] }>('vacation_find_best_windows', {
      from: '2099-05-01',
      to: '2099-05-31',
      leaveDays: 5,
      objective: 'max_rest',
      top: 3,
    });
    expect(data.windows.length).toBeGreaterThan(0);
    for (const w of data.windows) expect(w.balanceCost).toBe(5);
  });

  it('vacation_get_calendar neither pays nor charges a public holiday', async () => {
    const data = await call<{ rows: [string, number, number, number, string[]][] }>('vacation_get_calendar', {
      from: '2099-05-01',
      to: '2099-05-03',
    });
    expect(data.rows).toHaveLength(3);
    const [, delta, amount, cost, markers] = data.rows[0]!;
    expect([delta, amount, cost]).toEqual([0, 0, 0]);
    expect(markers).toContain('holiday');
  });

  it('vacation_get_balance charges planned leave in calendar days', async () => {
    const withPlanned = await call<{ totalDays: number }>('vacation_get_balance', { date: '2099-06-30' });
    const without = await call<{ totalDays: number }>('vacation_get_balance', {
      date: '2099-06-30',
      includePlanned: false,
    });
    expect(Math.round((without.totalDays - withPlanned.totalDays) * 100) / 100).toBe(5);
  });
});
