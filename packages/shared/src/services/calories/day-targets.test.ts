/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentDateString, shiftDateStr } from '../../utils/dates';
import { deleteAllUserCalorieDayTargets, freezeDayTargets, getDayTargetsForRange } from './day-targets';

vi.mock('../../db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    query: { calorieProfiles: { findFirst: vi.fn() } },
  },
}));

import { db } from '../../db/client';

const NOW = new Date('2026-11-22T10:00:00Z');
// A fixed max: the live rule then needs no weight, and every non-gym day reads 2300.
const PROFILE = { goalMaxCalories: 2300, goalMinCalories: 1800, gymDays: [], gymDayCalorieBonus: 300 } as any;

/** A query builder that returns itself for every step and resolves to `rows` when awaited. */
function chain(rows: unknown[]) {
  const c: any = new Proxy(
    {},
    { get: (_, key) => (key === 'then' ? (ok: any, ko: any) => Promise.resolve(rows).then(ok, ko) : () => c) },
  );
  return c;
}

function mockInsert() {
  const values = vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) });
  vi.mocked(db).insert.mockReturnValueOnce({ values } as any);
  return values;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.query.calorieProfiles.findFirst).mockResolvedValue(PROFILE);
});

describe('getDayTargetsForRange', () => {
  it('keeps a frozen day as it was and answers the rest from the profile, writing nothing', async () => {
    vi.mocked(db).select.mockReturnValueOnce(
      chain([{ date: '2026-11-10', target: 2000, min: 1500, isGymDay: true, gymDayBonus: 400 }]),
    );
    const days = await getDayTargetsForRange('u', '2026-11-10', '2026-11-11', { profile: PROFILE, weightKg: null });

    expect(days.get('2026-11-10')).toEqual({ target: 2000, min: 1500, isGymDay: true, gymDayBonus: 400 });
    expect(days.get('2026-11-11')).toMatchObject({ target: 2300, min: 1800, isGymDay: false });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.query.calorieProfiles.findFirst).not.toHaveBeenCalled();
  });

  it('loads the profile itself when the caller passes none, and returns every date', async () => {
    vi.mocked(db).select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    const days = await getDayTargetsForRange('u', '2026-11-19', '2026-11-22');

    expect([...days.keys()]).toEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect([...days.values()].every(d => d.target === 2300)).toBe(true);
    expect(db.query.calorieProfiles.findFirst).toHaveBeenCalledOnce();
  });
});

describe('freezeDayTargets', () => {
  /**
   * The freeze's reads, in the order it makes them: the user's timezone, their first meal date, the
   * profile (created at `createdAt`; `null` for none), the latest weigh-in and the frozen dates.
   */
  function mockFreeze({
    timezone = '+2' as string | null,
    firstMeal = null as string | null,
    createdAt = '2026-11-21',
    frozen = [] as string[],
    profile = PROFILE as object | null,
  }) {
    vi.mocked(db)
      .select.mockReturnValueOnce(chain([{ timezone }]))
      .mockReturnValueOnce(chain([{ date: firstMeal }]))
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain(frozen.map(date => ({ date }))));
    vi.mocked(db.query.calorieProfiles.findFirst).mockResolvedValue(
      profile && ({ ...profile, createdAt: new Date(`${createdAt}T08:00:00Z`) } as any),
    );
    return mockInsert();
  }
  const frozenDates = (values: ReturnType<typeof mockInsert>) =>
    (values.mock.calls[0]![0] as { date: string }[]).map(r => r.date);
  const day = (date: string) => ({ userId: 'u', date, target: 2300, min: 1800, isGymDay: false, gymDayBonus: 300 });

  it('stores every unfrozen finished day from the first meal, empty days included', async () => {
    const values = mockFreeze({ firstMeal: '2026-11-18', createdAt: '2026-11-19', frozen: ['2026-11-20'] });

    // 10:00 UTC is 12:00 at +2, so the 22nd is today and the 21st the last finished day.
    await expect(freezeDayTargets('u', NOW)).resolves.toBe(3);
    expect(values.mock.calls[0]![0]).toEqual([day('2026-11-18'), day('2026-11-19'), day('2026-11-21')]);
  });

  it('starts at the profile when it predates the first meal, and with no meals at all', async () => {
    const values = mockFreeze({ createdAt: '2026-11-20' });
    await freezeDayTargets('u', NOW);
    expect(frozenDates(values)).toEqual(['2026-11-20', '2026-11-21']);
  });

  it('ends the day before today in an IANA zone already past midnight', async () => {
    const values = mockFreeze({ timezone: 'Pacific/Auckland' });
    // 12:00 UTC on the 22nd is 01:00 on the 23rd in Auckland, so the 22nd is finished there.
    await freezeDayTargets('u', new Date('2026-11-22T12:00:00Z'));
    expect(frozenDates(values)).toEqual(['2026-11-21', '2026-11-22']);
  });

  it('with no timezone, ends the day before the today the readers use', async () => {
    const values = mockFreeze({ timezone: null, createdAt: '2026-11-20' });
    const at = new Date('2026-11-22T12:00:00Z');
    await freezeDayTargets('u', at);
    expect(frozenDates(values).at(-1)).toBe(shiftDateStr(currentDateString(null, at), -1));
  });

  it('freezes a day with only a floor, so changing the floor later leaves it be', async () => {
    const values = mockFreeze({
      profile: { goalMinCalories: 1800, goalMaxCalories: null, gymDays: [], gymDayCalorieBonus: 0 },
    });
    await freezeDayTargets('u', NOW);
    expect(values.mock.calls[0]![0]).toEqual([
      { userId: 'u', date: '2026-11-21', target: null, min: 1800, isGymDay: false, gymDayBonus: 0 },
    ]);
  });

  it('writes nothing without a profile', async () => {
    mockFreeze({ firstMeal: '2026-11-20', profile: null });
    await expect(freezeDayTargets('u', NOW)).resolves.toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('writes nothing when every finished day is frozen', async () => {
    mockFreeze({ createdAt: '2026-11-20', frozen: ['2026-11-20', '2026-11-21'] });
    await expect(freezeDayTargets('u', NOW)).resolves.toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('deleteAllUserCalorieDayTargets', () => {
  it("deletes the user's frozen ranges and returns how many went", async () => {
    const where = vi.fn().mockReturnThis();
    vi.mocked(db).delete.mockReturnValueOnce({
      where,
      returning: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    } as any);
    await expect(deleteAllUserCalorieDayTargets('u')).resolves.toBe(2);
    expect(where).toHaveBeenCalledOnce();
  });
});
