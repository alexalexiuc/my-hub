import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserActiveBudget,
  getAccountFlows,
  getSavingsContributions,
  getMonthlyFinanceReport,
  getYearlyFinanceReport,
} from '@my-hub/shared/services';
import {
  getAccountFlowsTool,
  getSavingsContributionsTool,
  getMonthlyReportTool,
  getYearlyReportTool,
  GetMonthlyReportSchema,
  GetYearlyReportSchema,
} from './reporting';
import { financesContext } from './test-utils';

vi.mock('@my-hub/shared/services', () => ({
  getUserActiveBudget: vi.fn(),
  getAccountFlows: vi.fn(),
  getSavingsContributions: vi.fn(),
  getMonthlyFinanceReport: vi.fn(),
  getYearlyFinanceReport: vi.fn(),
}));

describe('reporting tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserActiveBudget).mockResolvedValue({ id: 7 } as never);
  });

  it('getAccountFlowsTool passes accountId through when provided', async () => {
    vi.mocked(getAccountFlows).mockResolvedValue({ dateFrom: '2026-01-01', dateTo: '2026-01-31', accounts: [] });

    await getAccountFlowsTool({ dateFrom: '2026-01-01', dateTo: '2026-01-31', accountId: 15 }, financesContext);

    expect(getAccountFlows).toHaveBeenCalledWith('user-1', 7, '2026-01-01', '2026-01-31', 15);
  });

  it('getAccountFlowsTool omits accountId when not provided', async () => {
    vi.mocked(getAccountFlows).mockResolvedValue({ dateFrom: '2026-01-01', dateTo: '2026-01-31', accounts: [] });

    await getAccountFlowsTool({ dateFrom: '2026-01-01', dateTo: '2026-01-31', accountId: undefined }, financesContext);

    expect(getAccountFlows).toHaveBeenCalledWith('user-1', 7, '2026-01-01', '2026-01-31', undefined);
  });

  it('getSavingsContributionsTool forwards the date range', async () => {
    vi.mocked(getSavingsContributions).mockResolvedValue({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      totalNetContribution: 0,
      accounts: [],
      previousPeriod: { dateFrom: '2025-12-01', dateTo: '2025-12-31', totalNetContribution: 0 },
    });

    await getSavingsContributionsTool({ dateFrom: '2026-01-01', dateTo: '2026-01-31' }, financesContext);

    expect(getSavingsContributions).toHaveBeenCalledWith('user-1', 7, '2026-01-01', '2026-01-31');
  });

  it('getMonthlyReportTool defaults month to undefined when omitted', async () => {
    vi.mocked(getMonthlyFinanceReport).mockResolvedValue({} as never);

    await getMonthlyReportTool({ month: undefined }, financesContext);

    expect(getMonthlyFinanceReport).toHaveBeenCalledWith('user-1', 7, undefined);
  });

  it('getMonthlyReportTool rejects a malformed month', () => {
    const parsed = GetMonthlyReportSchema.safeParse({ month: '2026/01' });
    expect(parsed.success).toBe(false);
  });

  it('getYearlyReportTool passes year through', async () => {
    vi.mocked(getYearlyFinanceReport).mockResolvedValue({} as never);

    await getYearlyReportTool({ year: 2025 }, financesContext);

    expect(getYearlyFinanceReport).toHaveBeenCalledWith('user-1', 7, 2025);
  });

  it('getYearlyReportTool rejects an out-of-range year', () => {
    const parsed = GetYearlyReportSchema.safeParse({ year: 1899 });
    expect(parsed.success).toBe(false);
  });

  it('throws when there is no active budget', async () => {
    vi.mocked(getUserActiveBudget).mockResolvedValue(null);

    await expect(
      getAccountFlowsTool({ dateFrom: '2026-01-01', dateTo: '2026-01-31', accountId: undefined }, financesContext),
    ).rejects.toThrow('No active budget.');
  });
});
