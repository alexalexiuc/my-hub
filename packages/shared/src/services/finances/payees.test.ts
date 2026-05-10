/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findPayeeByNameOrAlias, getPayees, decrementPayeeStats } from './payees';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock('./budgets.js', () => ({ hasAccessToBudget: vi.fn() }));

import { db } from '../../db/client.js';
import { hasAccessToBudget } from './budgets.js';

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
