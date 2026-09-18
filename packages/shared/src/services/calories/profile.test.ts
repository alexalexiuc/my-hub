/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCalorieProfile, generateCaloriesAutomationKey, upsertCalorieProfile } from './profile';

vi.mock('../../db/client.js', () => ({
  db: {
    query: { calorieProfiles: { findFirst: vi.fn() } },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '../../db/client.js';

// `vi.mocked` only re-types the top level, and `db.query.calorieProfiles.findFirst` keeps its real
// Drizzle signature — which has no `mockResolvedValueOnce`. Alias the mock once, typed as one.
const findFirst = db.query.calorieProfiles.findFirst as unknown as ReturnType<typeof vi.fn>;

const PROFILE = { id: 1, userId: 'user-1', age: 34, sex: 'male', heightCm: 178, automationApiKey: null };

function mockUpdate(rows: unknown[]) {
  const set = vi.fn().mockReturnThis();
  vi.mocked(db).update.mockReturnValueOnce({
    set,
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
  return set;
}

function mockInsert(rows: unknown[]) {
  const values = vi.fn().mockReturnThis();
  vi.mocked(db).insert.mockReturnValueOnce({
    values,
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
  return values;
}

/** The `weight` lookup behind the goal baseline: one row, or none if never weighed. */
function mockLatestWeight(rows: { value: number }[]) {
  vi.mocked(db).select.mockReturnValueOnce({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  } as any);
}

function mockDelete(rows: unknown[]) {
  vi.mocked(db).delete.mockReturnValueOnce({
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
}

describe('upsertCalorieProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates in place when a profile already exists', async () => {
    findFirst.mockResolvedValueOnce(PROFILE as any);
    const set = mockUpdate([{ ...PROFILE, age: 35 }]);

    const result = await upsertCalorieProfile('user-1', { age: 35 });

    expect(result.age).toBe(35);
    expect(vi.mocked(db).insert).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ age: 35, updatedAt: expect.any(Date) }));
  });

  it('inserts a first profile when none exists, stamping the owner', async () => {
    findFirst.mockResolvedValueOnce(undefined);
    const values = mockInsert([PROFILE]);

    await upsertCalorieProfile('user-1', { age: 34 });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', age: 34 }));
    expect(vi.mocked(db).update).not.toHaveBeenCalled();
  });

  it('throws rather than returning nothing when the write reports no row', async () => {
    findFirst.mockResolvedValueOnce(PROFILE as any);
    mockUpdate([]);

    await expect(upsertCalorieProfile('user-1', { age: 35 })).rejects.toThrow(/did not return a row/i);
  });
});

/**
 * The baseline is what keeps a goal cumulative: the projection runs from it rather than from each
 * week's first weigh-in. It must therefore move only on purpose — a baseline that re-stamped on
 * every save would reproduce the silent weekly rebase it exists to replace.
 */
describe('upsertCalorieProfile — goal baseline', () => {
  const today = new Date().toISOString().slice(0, 10);
  const GOALLESS = { ...PROFILE, goalType: null, goalWeeklyRateKg: null, goalStartDate: null, goalStartWeightKg: null };
  const ON_GOAL = {
    ...PROFILE,
    goalType: 'weight_loss',
    goalWeeklyRateKg: 1,
    goalStartDate: '2026-09-01',
    goalStartWeightKg: 98,
  };

  beforeEach(() => vi.clearAllMocks());

  it('stamps today and the latest weight when a goal is first set', async () => {
    findFirst.mockResolvedValueOnce(GOALLESS as any);
    mockLatestWeight([{ value: 96.3 }]);
    const set = mockUpdate([ON_GOAL]);

    await upsertCalorieProfile('user-1', { goalType: 'weight_loss', goalWeeklyRateKg: 1 });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ goalStartDate: today, goalStartWeightKg: 96.3 }));
  });

  it('re-stamps when the goal rate changes, because that starts a new run', async () => {
    findFirst.mockResolvedValueOnce(ON_GOAL as any);
    mockLatestWeight([{ value: 94 }]);
    const set = mockUpdate([ON_GOAL]);

    await upsertCalorieProfile('user-1', { goalWeeklyRateKg: 0.5 });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ goalStartDate: today, goalStartWeightKg: 94 }));
  });

  it('leaves an established baseline alone when the goal itself did not change', async () => {
    findFirst.mockResolvedValueOnce(ON_GOAL as any);
    const set = mockUpdate([ON_GOAL]);

    await upsertCalorieProfile('user-1', { age: 35, goalWeeklyRateKg: 1 });

    expect(vi.mocked(db).select).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ goalStartDate: expect.anything() }));
  });

  it('adopts an explicit baseline rather than overwriting it with today', async () => {
    findFirst.mockResolvedValueOnce(ON_GOAL as any);
    const set = mockUpdate([ON_GOAL]);

    await upsertCalorieProfile('user-1', { goalStartDate: '2026-08-01', goalStartWeightKg: 99 });

    expect(vi.mocked(db).select).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ goalStartDate: '2026-08-01', goalStartWeightKg: 99 }));
  });

  it('backfills a baseline for a goal that predates the column', async () => {
    findFirst.mockResolvedValueOnce({ ...ON_GOAL, goalStartDate: null, goalStartWeightKg: null } as any);
    mockLatestWeight([{ value: 95 }]);
    const set = mockUpdate([ON_GOAL]);

    await upsertCalorieProfile('user-1', { age: 35 });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ goalStartDate: today, goalStartWeightKg: 95 }));
  });

  it('stamps nothing when there is no weigh-in to anchor to', async () => {
    findFirst.mockResolvedValueOnce(GOALLESS as any);
    mockLatestWeight([]);
    const set = mockUpdate([GOALLESS]);

    await upsertCalorieProfile('user-1', { goalType: 'weight_loss', goalWeeklyRateKg: 1 });

    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ goalStartDate: expect.anything() }));
  });

  it('waits for the rate before anchoring a loss goal', async () => {
    findFirst.mockResolvedValueOnce(GOALLESS as any);
    const set = mockUpdate([GOALLESS]);

    await upsertCalorieProfile('user-1', { goalType: 'weight_loss' });

    // A line that cannot be drawn yet should not fix its starting point.
    expect(vi.mocked(db).select).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ goalStartDate: expect.anything() }));
  });

  it('anchors a maintain goal, which needs no rate', async () => {
    findFirst.mockResolvedValueOnce(GOALLESS as any);
    mockLatestWeight([{ value: 96 }]);
    const set = mockUpdate([GOALLESS]);

    await upsertCalorieProfile('user-1', { goalType: 'maintain' });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ goalStartDate: today, goalStartWeightKg: 96 }));
  });

  it('does not anchor a profile with no goal at all', async () => {
    findFirst.mockResolvedValueOnce(GOALLESS as any);
    const set = mockUpdate([GOALLESS]);

    await upsertCalorieProfile('user-1', { age: 35 });

    expect(vi.mocked(db).select).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ goalStartDate: expect.anything() }));
  });
});

describe('deleteCalorieProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports whether anything was deleted', async () => {
    mockDelete([{ id: 1 }]);
    expect(await deleteCalorieProfile('user-1')).toBe(true);

    mockDelete([]);
    expect(await deleteCalorieProfile('user-1')).toBe(false);
  });
});

describe('generateCaloriesAutomationKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists a 64-character hex key', async () => {
    findFirst.mockResolvedValueOnce(PROFILE as any);
    const set = mockUpdate([{ ...PROFILE, automationApiKey: 'x'.repeat(64) }]);

    const key = await generateCaloriesAutomationKey('user-1');

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ automationApiKey: key }));
  });

  it('issues a different key each time, so regenerating actually rotates it', async () => {
    findFirst.mockResolvedValue(PROFILE as any);
    mockUpdate([PROFILE]);
    const first = await generateCaloriesAutomationKey('user-1');
    mockUpdate([PROFILE]);
    const second = await generateCaloriesAutomationKey('user-1');

    expect(first).not.toBe(second);
  });
});
