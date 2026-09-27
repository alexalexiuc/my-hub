import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findBestLeaveWindows, getVacationCalendar, VacationValidationError } from '@my-hub/shared/services';
import type { HubAuthExtra } from '../../shared/types';
import {
  FindBestWindowsSchema,
  findBestWindowsTool,
  GetCalendarSchema,
  getCalendarTool,
  VacationSetupSchema,
} from './vacation';

vi.mock('@my-hub/shared/services', () => {
  class VacationValidationError extends Error {}
  return {
    VacationValidationError,
    applyLeaveChanges: vi.fn(),
    applyVacationSetup: vi.fn(),
    evaluateVacationSpan: vi.fn(),
    findBestLeaveWindows: vi.fn(),
    getVacationBalance: vi.fn(),
    getVacationCalendar: vi.fn(),
    getVacationConfig: vi.fn(),
  };
});

type FindInput = Parameters<typeof findBestWindowsTool>[0];
type CalendarInput = Parameters<typeof getCalendarTool>[0];

const context: HubAuthExtra = {
  userId: 'user-1',
  email: 'user@example.com',
  clientId: 'client-1',
  serverName: 'vacation',
  timezone: 'Europe/Chisinau',
};

describe('vacation tool schemas', () => {
  it('validates salary months as YYYY-MM', () => {
    expect(
      VacationSetupSchema.safeParse({ salaries: { upsert: [{ month: '2026-13', baseMdl: 1, kind: 'actual' }] } })
        .success,
    ).toBe(false);
    expect(
      VacationSetupSchema.safeParse({ salaries: { upsert: [{ month: '2026-05', baseMdl: 1, kind: 'actual' }] } })
        .success,
    ).toBe(true);
  });

  it('bounds leaveDays and restDays', () => {
    expect(FindBestWindowsSchema.safeParse({ leaveDays: 0 }).success).toBe(false);
    expect(FindBestWindowsSchema.safeParse({ restDays: 61 }).success).toBe(false);
    expect(FindBestWindowsSchema.safeParse({ leaveDays: 7, objective: 'max_rest' }).success).toBe(true);
  });
});

describe('vacation tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T10:00:00Z'));
  });

  it('defaults the best-window search to the next 182 days from today', async () => {
    vi.mocked(findBestLeaveWindows).mockResolvedValue({ objective: 'max_money', windows: [], warnings: [] });
    await findBestWindowsTool(FindBestWindowsSchema.parse({ leaveDays: 7 }) as FindInput, context);
    expect(findBestLeaveWindows).toHaveBeenCalledWith('user-1', { leaveDays: 7, from: '2026-09-27', to: '2027-03-28' });
  });

  it('defaults the calendar to the current month', async () => {
    vi.mocked(getVacationCalendar).mockResolvedValue({ from: '', to: '', rows: [], rates: [], warnings: [] });
    await getCalendarTool(GetCalendarSchema.parse({}) as CalendarInput, context);
    expect(getVacationCalendar).toHaveBeenCalledWith('user-1', { from: '2026-09-01', to: '2026-09-30' });
  });

  it('propagates service validation errors unchanged', async () => {
    vi.mocked(findBestLeaveWindows).mockRejectedValue(
      new VacationValidationError('Pass exactly one of leaveDays or restDays.'),
    );
    await expect(findBestWindowsTool(FindBestWindowsSchema.parse({}) as FindInput, context)).rejects.toBeInstanceOf(
      VacationValidationError,
    );
  });
});
