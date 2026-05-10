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
  aliases: string[],
  statsByUser: Record<
    string,
    { count: number; lastUsedAt: string | null; lastUsedCategoryId: number | null; lastUsedAccountId: number | null }
  >,
) {
  return { id, name, aliases, description: null, normalizedName: name.toLowerCase(), budgetId: 1, statsByUser };
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
      makeDbPayee(1, 'Alpha', [], {
        'user-1': { count: 2, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', [], {
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
      makeDbPayee(1, 'Alpha', [], {
        'user-1': { count: 3, lastUsedAt: '2026-01-01', lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', [], {
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
      makeDbPayee(1, 'Alpha', [], {
        'user-1': { count: 1, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', [], {
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
      makeDbPayee(1, 'Zara', [], {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Acme', ['Acme LLC'], {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(3, 'Midway', [], {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
    ];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    const result = await getPayees('user-1', 1);

    expect(result.map(p => p.name)).toEqual(['Acme', 'Midway', 'Zara']);
    expect(result[0]?.aliases).toEqual(['Acme LLC']);
  });
});

describe('findPayeeByNameOrAlias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('returns a payee when the lookup name matches an alias in its array', async () => {
    const payees = [makeDbPayee(2, 'Acme', ['Acme SRL', 'Acme Corp'], {})];
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
    const payee = makeDbPayee(5, 'Shop', [], {
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
    const payee = makeDbPayee(5, 'Shop', [], {
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

  it('merges stats from source payees into target', async () => {
    const target = makeDbPayee(10, 'Target', [], {
      'user-1': { count: 5, lastUsedAt: '2026-04-01T10:00:00.000Z', lastUsedCategoryId: 100, lastUsedAccountId: 200 },
    });
    const source1 = makeDbPayee(11, 'Old A', ['Old A SRL'], {
      'user-1': { count: 3, lastUsedAt: '2026-04-02T10:00:00.000Z', lastUsedCategoryId: 101, lastUsedAccountId: 201 },
      'user-2': { count: 2, lastUsedAt: '2026-03-15T10:00:00.000Z', lastUsedCategoryId: null, lastUsedAccountId: null },
    });
    const source2 = makeDbPayee(12, 'Old B', [], {
      'user-1': { count: 1, lastUsedAt: '2026-03-20T10:00:00.000Z', lastUsedCategoryId: 102, lastUsedAccountId: 202 },
    });

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
          count: 9, // 5 (target) + 3 (source1) + 1 (source2)
          lastUsedAt: '2026-04-02T10:00:00.000Z', // Most recent from source1
          lastUsedCategoryId: 101,
          lastUsedAccountId: 201,
        },
        'user-2': {
          count: 2, // Only from source1
          lastUsedAt: '2026-03-15T10:00:00.000Z',
          lastUsedCategoryId: null,
          lastUsedAccountId: null,
        },
      },
    });
  });

  it('preserves target stats when sources have no stats', async () => {
    const target = makeDbPayee(20, 'Target', [], {
      'user-1': { count: 5, lastUsedAt: '2026-01-01T10:00:00.000Z', lastUsedCategoryId: 9, lastUsedAccountId: 9 },
    });
    const source = makeDbPayee(21, 'Source', [], {});

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
    expect(payeeStatsUpdate?.values).toEqual({
      statsByUser: {
        'user-1': { count: 5, lastUsedAt: '2026-01-01T10:00:00.000Z', lastUsedCategoryId: 9, lastUsedAccountId: 9 },
      },
    });
  });

  it('picks most recent lastUsedAt when merging stats from multiple sources', async () => {
    const target = makeDbPayee(30, 'Target', [], {});
    const source1 = makeDbPayee(31, 'Old A', [], {
      'user-1': { count: 2, lastUsedAt: '2026-04-01T10:00:00.000Z', lastUsedCategoryId: 101, lastUsedAccountId: 201 },
    });
    const source2 = makeDbPayee(32, 'Old B', ['Old B Corp'], {
      'user-1': { count: 3, lastUsedAt: '2026-04-05T10:00:00.000Z', lastUsedCategoryId: 102, lastUsedAccountId: 202 },
    });

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

    await mergePayees('user-1', 1, 30, [31, 32]);

    const payeeStatsUpdate = updateCalls.find(c => c.table === financePayees);
    expect(payeeStatsUpdate?.values).toEqual({
      statsByUser: {
        'user-1': {
          count: 5, // 2 + 3
          lastUsedAt: '2026-04-05T10:00:00.000Z', // More recent
          lastUsedCategoryId: 102,
          lastUsedAccountId: 202,
        },
      },
    });
  });

  it('throws when the target payee is missing inside the transaction', async () => {
    const source = makeDbPayee(31, 'Source', [], {});

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
