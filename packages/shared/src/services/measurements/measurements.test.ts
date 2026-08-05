/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteAllUserMeasurements,
  deleteMeasurement,
  getLatestMeasurementsPerType,
  logMeasurement,
  updateMeasurement,
} from './measurements';

vi.mock('../../db/client.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
}));

import { db } from '../../db/client.js';

const ROW = {
  id: 7,
  userId: 'user-1',
  typeKey: 'weight',
  value: 77.5,
  date: '2026-08-01',
  notes: null,
  entrySource: 'hub',
  createdAt: new Date(),
};

/** Captures what reaches Drizzle's `.set()` — see the equivalent note in meals.test.ts. */
function mockUpdate(rows: unknown[]) {
  const set = vi.fn().mockReturnThis();
  vi.mocked(db).update.mockReturnValueOnce({
    set,
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  } as any);
  return set;
}

describe('updateMeasurement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('drops undefined fields and keeps an explicit null', async () => {
    const set = mockUpdate([{ ...ROW, notes: null }]);

    await updateMeasurement(7, 'user-1', { value: 76, date: undefined, notes: null });

    expect(set).toHaveBeenCalledWith({ value: 76, notes: null });
  });

  it('returns null when the row belongs to someone else', async () => {
    mockUpdate([]);

    expect(await updateMeasurement(7, 'other-user', { value: 76 })).toBeNull();
  });

  // Matches the meal PATCH: routes reject an empty patch before it reaches the service, so the
  // service never has to invent a meaning for "change nothing".
  it('sends whatever survives filtering, without a fallback read', async () => {
    const set = mockUpdate([ROW]);

    await updateMeasurement(7, 'user-1', { typeKey: 'weight' });

    expect(set).toHaveBeenCalledWith({ typeKey: 'weight' });
    expect(vi.mocked(db).select).not.toHaveBeenCalled();
  });
});

describe('logMeasurement', () => {
  beforeEach(() => vi.clearAllMocks());

  // Rounded to 4 decimals, which is about taming float drift from the `real` column rather than
  // limiting how precisely a user may weigh themselves.
  it('rounds the value on the way in and on the way out', async () => {
    const values = vi.fn().mockReturnThis();
    vi.mocked(db).insert.mockReturnValueOnce({
      values,
      returning: vi.fn().mockResolvedValue([{ ...ROW, value: 77.12345678 }]),
    } as any);

    const result = await logMeasurement({ ...ROW, value: 77.12345678 } as any);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ value: 77.1235 }));
    expect(result.value).toBe(77.1235);
  });

  it('leaves a value that already fits within four decimals untouched', async () => {
    const values = vi.fn().mockReturnThis();
    vi.mocked(db).insert.mockReturnValueOnce({
      values,
      returning: vi.fn().mockResolvedValue([{ ...ROW, value: 77.5 }]),
    } as any);

    await logMeasurement({ ...ROW, value: 77.5 } as any);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ value: 77.5 }));
  });

  it('throws rather than returning nothing when the insert reports no row', async () => {
    vi.mocked(db).insert.mockReturnValueOnce({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    } as any);

    await expect(logMeasurement({ ...ROW } as any)).rejects.toThrow(/did not return a row/i);
  });
});

describe('getLatestMeasurementsPerType', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps only the newest entry per type and attaches its label and unit', async () => {
    // The query orders newest first, so the first row of each type is the one to keep.
    const rows = [
      { ...ROW, id: 3, typeKey: 'weight', value: 74.2, date: '2026-08-02' },
      { ...ROW, id: 2, typeKey: 'waist', value: 84, date: '2026-08-01' },
      { ...ROW, id: 1, typeKey: 'weight', value: 77.5, date: '2026-07-30' },
    ];
    vi.mocked(db).select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(rows),
    } as any);

    const latest = await getLatestMeasurementsPerType('user-1');

    expect(latest).toHaveLength(2);
    expect(latest.map(m => m.id)).toEqual([3, 2]);
    expect(latest[0]).toMatchObject({ typeKey: 'weight', value: 74.2, typeLabel: 'Weight', typeUnit: 'kg' });
  });
});

describe('deleteMeasurement', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockDelete(rows: unknown[]) {
    vi.mocked(db).delete.mockReturnValueOnce({
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(rows),
    } as any);
  }

  it('returns the deleted row, or null when it was not the user’s to delete', async () => {
    mockDelete([ROW]);
    expect(await deleteMeasurement(7, 'user-1')).toEqual(ROW);

    mockDelete([]);
    expect(await deleteMeasurement(7, 'other-user')).toBeNull();
  });

  it('counts the rows removed for a full wipe', async () => {
    mockDelete([{ id: 1 }, { id: 2 }]);
    expect(await deleteAllUserMeasurements('user-1')).toBe(2);
  });
});
