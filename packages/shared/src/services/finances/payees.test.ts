/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findPayeeByNameOrAlias, getPayees, decrementPayeeStats, mergePayees } from './payees';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));
vi.mock('./budgets.js', () => ({ hasAccessToBudget: vi.fn() }));

import { db } from '../../db/client.js';
import { hasAccessToBudget } from './budgets.js';
import { financePayees, financeTransactions } from '../../db/schema/finances';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDbPayee(
  id: number,
  name: string,
  alias: string | null,
  statsByUser: Record<
    string,
    { count: number; lastUsedAt: string | null; lastUsedCategoryId: number | null; lastUsedAccountId: number | null }
  >,
) {
  return { id, name, alias, description: null, normalizedName: name.toLowerCase(), budgetId: 1, statsByUser };
}

function makeSelectChain(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

// ─── getPayees — sort order ───────────────────────────────────────────────────

describe('getPayees sort order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('places payee with higher useCount first', async () => {
    const payees = [
      makeDbPayee(1, 'Alpha', null, {
        'user-1': { count: 2, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', null, {
        'user-1': { count: 5, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
    ];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    const result = await getPayees('user-1', 1);

    expect(result[0]?.name).toBe('Beta');
    expect(result[1]?.name).toBe('Alpha');
  });

  it('places payee with more recent lastUsedAt first when useCount is tied', async () => {
    const payees = [
      makeDbPayee(1, 'Alpha', null, {
        'user-1': { count: 3, lastUsedAt: '2026-01-01', lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', null, {
        'user-1': { count: 3, lastUsedAt: '2026-03-15', lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
    ];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    const result = await getPayees('user-1', 1);

    expect(result[0]?.name).toBe('Beta');
    expect(result[1]?.name).toBe('Alpha');
  });

  it('places payee with a lastUsedAt before payee with null', async () => {
    const payees = [
      makeDbPayee(1, 'Alpha', null, {
        'user-1': { count: 1, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', null, {
        'user-1': { count: 1, lastUsedAt: '2026-02-01', lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
    ];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    const result = await getPayees('user-1', 1);

    expect(result[0]?.name).toBe('Beta');
    expect(result[1]?.name).toBe('Alpha');
  });

  it('sorts alphabetically by name when useCount and lastUsedAt are both tied/null', async () => {
    const payees = [
      makeDbPayee(1, 'Zara', null, {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Acme', 'Acme LLC', {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(3, 'Midway', null, {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
    ];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    const result = await getPayees('user-1', 1);

    expect(result.map(p => p.name)).toEqual(['Acme', 'Midway', 'Zara']);
    expect(result[0]?.alias).toBe('Acme LLC');
  });
});

describe('findPayeeByNameOrAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('returns a payee when the lookup name matches its alias', async () => {
    const payees = [makeDbPayee(2, 'Acme', 'Acme SRL', {})];
    (vi.mocked(db) as any).select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(payees),
    });

    const result = await findPayeeByNameOrAlias('user-1', 1, 'acme srl');

    expect(result?.id).toBe(2);
    expect(result?.name).toBe('Acme');
  });

  it('returns null when no canonical name or alias matches', async () => {
    (vi.mocked(db) as any).select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    const result = await findPayeeByNameOrAlias('user-1', 1, 'unknown vendor');

    expect(result).toBeNull();
  });
});

// ─── decrementPayeeStats ──────────────────────────────────────────────────────

describe('decrementPayeeStats', () => {
  function makeTx(payee: ReturnType<typeof makeDbPayee>) {
    const updateSetWhere = vi.fn().mockResolvedValue([]);
    const updateSet = vi.fn().mockReturnValue({ where: updateSetWhere });
    return {
      select: vi.fn(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([payee]),
      })),
      update: vi.fn(() => ({ set: updateSet })),
      _updateSet: updateSet,
    };
  }

  it('decrements count by 1 when count > 0', async () => {
    const payee = makeDbPayee(5, 'Shop', null, {
      'user-1': { count: 3, lastUsedAt: '2026-04-01', lastUsedCategoryId: null, lastUsedAccountId: null },
    });
    const tx = makeTx(payee);

    await decrementPayeeStats(tx as any, 5, 'user-1');

    expect(tx._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        statsByUser: expect.objectContaining({
          'user-1': expect.objectContaining({ count: 2 }),
        }),
      }),
    );
  });

  it('floors count at 0 and does not go negative', async () => {
    const payee = makeDbPayee(5, 'Shop', null, {
      'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
    });
    const tx = makeTx(payee);

    await decrementPayeeStats(tx as any, 5, 'user-1');

    expect(tx._updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        statsByUser: expect.objectContaining({
          'user-1': expect.objectContaining({ count: 0 }),
        }),
      }),
    );
  });
});

// ─── mergePayees ─────────────────────────────────────────────────────────────

describe('mergePayees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('recomputes target statsByUser from reassigned transactions', async () => {
    const target = makeDbPayee(10, 'Target', null, {
      staleUser: { count: 99, lastUsedAt: '2020-01-01', lastUsedCategoryId: 1, lastUsedAccountId: 1 },
    });
    const source1 = makeDbPayee(11, 'Old A', null, {});
    const source2 = makeDbPayee(12, 'Old B', null, {});

    const updateCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];

    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockResolvedValue([target]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockResolvedValue([source1, source2]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([
            {
              addedByUserId: 'user-1',
              categoryId: 101,
              accountId: 201,
              createdAt: new Date('2026-04-02T10:00:00.000Z'),
            },
            {
              addedByUserId: 'user-1',
              categoryId: 102,
              accountId: 202,
              createdAt: new Date('2026-04-01T10:00:00.000Z'),
            },
            {
              addedByUserId: 'user-2',
              categoryId: null,
              accountId: 303,
              createdAt: new Date('2026-04-03T10:00:00.000Z'),
            },
          ]),
        }),
      update: vi.fn((table: unknown) => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn().mockImplementation(async () => {
            updateCalls.push({ table, values });
            return [];
          }),
        })),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    };

    (vi.mocked(db) as any).transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<unknown>) => cb(tx));

    const result = await mergePayees('user-1', 1, 10, [11, 12]);

    expect(result).toEqual({ mergedCount: 2, targetId: 10, canonicalName: 'Target' });

    const transactionReassignUpdate = updateCalls.find(c => c.table === financeTransactions);
    expect(transactionReassignUpdate?.values).toEqual(
      expect.objectContaining({
        payeeId: 10,
      }),
    );

    const payeeStatsUpdate = updateCalls.find(c => c.table === financePayees);
    expect(payeeStatsUpdate?.values).toEqual({
      statsByUser: {
        'user-1': {
          count: 2,
          lastUsedAt: '2026-04-02T10:00:00.000Z',
          lastUsedCategoryId: 101,
          lastUsedAccountId: 201,
        },
        'user-2': {
          count: 1,
          lastUsedAt: '2026-04-03T10:00:00.000Z',
          lastUsedCategoryId: null,
          lastUsedAccountId: 303,
        },
      },
    });
  });

  it('writes empty statsByUser when target has no transactions', async () => {
    const target = makeDbPayee(20, 'Target', null, {
      staleUser: { count: 3, lastUsedAt: '2026-01-01', lastUsedCategoryId: 9, lastUsedAccountId: 9 },
    });
    const source = makeDbPayee(21, 'Source', null, {});

    const updateCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];

    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockResolvedValue([target]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockResolvedValue([source]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      update: vi.fn((table: unknown) => ({
        set: vi.fn((values: Record<string, unknown>) => ({
          where: vi.fn().mockImplementation(async () => {
            updateCalls.push({ table, values });
            return [];
          }),
        })),
      })),
      delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    };

    (vi.mocked(db) as any).transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<unknown>) => cb(tx));

    await mergePayees('user-1', 1, 20, [21]);

    const payeeStatsUpdate = updateCalls.find(c => c.table === financePayees);
    expect(payeeStatsUpdate?.values).toEqual({ statsByUser: {} });
  });

  it('throws when the target payee is missing inside the transaction', async () => {
    const source = makeDbPayee(31, 'Source', null, {});

    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          for: vi.fn().mockResolvedValue([source]),
        }),
    };

    (vi.mocked(db) as any).transaction.mockImplementation(async (cb: (txArg: unknown) => Promise<unknown>) => cb(tx));

    await expect(mergePayees('user-1', 1, 30, [31])).rejects.toThrow('Payee id 30 not found');
  });

  it('rejects duplicate sourceIds with a clear error', async () => {
    await expect(mergePayees('user-1', 1, 30, [31, 31])).rejects.toThrow('sourceIds must not contain duplicates');
  });
});
