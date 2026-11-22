/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAllUserCalorieDayTargets, freezeDayTargets, getDayTargetsForRange } from './day-targets';

vi.mock('../../db/client', () => ({
  db: {
    select: vi.fn(),
    selectDistinct: vi.fn(),
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
  /** The user's timezone row, then the latest weigh-in (when the freeze gets that far). */
  function mockSelects(timezone: string | null) {
    vi.mocked(db)
      .select.mockReturnValueOnce(chain([{ timezone }]))
      .mockReturnValueOnce(chain([]));
  }

  it('stores the current range of each unfrozen day with meals', async () => {
    mockSelects('+2');
    vi.mocked(db).selectDistinct.mockReturnValueOnce(chain([{ date: '2026-11-20' }, { date: '2026-11-21' }]));
    const values = mockInsert();

    await expect(freezeDayTargets('u', NOW)).resolves.toBe(2);
    expect(values.mock.calls[0]![0]).toEqual([
      { userId: 'u', date: '2026-11-20', target: 2300, min: 1800, isGymDay: false, gymDayBonus: 300 },
      { userId: 'u', date: '2026-11-21', target: 2300, min: 1800, isGymDay: false, gymDayBonus: 300 },
    ]);
  });

  it("doesn't freeze a day the profile gives no target, so setting one up later still applies", async () => {
    mockSelects('+2');
    vi.mocked(db).selectDistinct.mockReturnValueOnce(chain([{ date: '2026-11-20' }]));
    vi.mocked(db.query.calorieProfiles.findFirst).mockResolvedValueOnce(undefined);

    await expect(freezeDayTargets('u', NOW)).resolves.toBe(0);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('loads nothing more and writes nothing when every past day is already frozen', async () => {
    mockSelects(null);
    vi.mocked(db).selectDistinct.mockReturnValueOnce(chain([]));

    await expect(freezeDayTargets('u', NOW)).resolves.toBe(0);
    expect(db.query.calorieProfiles.findFirst).not.toHaveBeenCalled();
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
