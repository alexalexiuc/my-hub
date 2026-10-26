/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addFavouriteMeal, removeFavouriteMeal } from './favourite-meals';

vi.mock('../../db/client.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), delete: vi.fn() },
}));

import { db } from '../../db/client.js';

const FAVOURITE = {
  id: 7,
  userId: 'user-1',
  description: 'Greek yogurt',
  mealType: 'breakfast',
  kcal: 180,
  protein: 18,
  carbs: 12,
  fat: 5,
  createdAt: new Date(),
};

describe('addFavouriteMeal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('trims the description and upserts on it, so re-pinning updates the macros', async () => {
    const values = vi.fn().mockReturnThis();
    const onConflictDoUpdate = vi.fn().mockReturnThis();
    vi.mocked(db).insert.mockReturnValueOnce({
      values,
      onConflictDoUpdate,
      returning: vi.fn().mockResolvedValue([FAVOURITE]),
    } as any);

    const input = {
      description: '  Greek yogurt ',
      mealType: 'breakfast',
      kcal: 180,
      protein: 18,
      carbs: 12,
      fat: 5,
    } as const;
    const row = await addFavouriteMeal('user-1', input);

    expect(values).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', description: 'Greek yogurt' }));
    expect(onConflictDoUpdate.mock.calls[0]![0].set).toMatchObject({ description: 'Greek yogurt', kcal: 180 });
    expect(row).toBe(FAVOURITE);
  });
});

describe('removeFavouriteMeal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when the user owns no such favourite', async () => {
    vi.mocked(db).delete.mockReturnValueOnce({
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    } as any);

    expect(await removeFavouriteMeal('user-1', 99)).toBeNull();
  });
});
