/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCalorieProfile, generateCaloriesAutomationKey, upsertCalorieProfile } from './profile';

vi.mock('../../db/client.js', () => ({
  db: {
    query: { calorieProfiles: { findFirst: vi.fn() } },
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
