/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPayees, decrementPayeeStats, updatePayee, upsertPayee } from './payees';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock('./budgets.js', () => ({ hasAccessToBudget: vi.fn() }));

import { db } from '../../db/client.js';
import { hasAccessToBudget } from './budgets.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDbPayee(
  id: number,
  name: string,
  statsByUser: Record<
    string,
    { count: number; lastUsedAt: string | null; lastUsedCategoryId: number | null; lastUsedAccountId: number | null }
  >,
) {
  return {
    id,
    name,
    aliases: [],
    notes: null,
    description: null,
    normalizedName: name.toLowerCase(),
    budgetId: 1,
    statsByUser,
  };
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
      makeDbPayee(1, 'Alpha', {
        'user-1': { count: 2, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', {
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
      makeDbPayee(1, 'Alpha', {
        'user-1': { count: 3, lastUsedAt: '2026-01-01', lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', {
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
      makeDbPayee(1, 'Alpha', {
        'user-1': { count: 1, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Beta', {
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
      makeDbPayee(1, 'Zara', {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(2, 'Acme', {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
      makeDbPayee(3, 'Midway', {
        'user-1': { count: 0, lastUsedAt: null, lastUsedCategoryId: null, lastUsedAccountId: null },
      }),
    ];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    const result = await getPayees('user-1', 1);

    expect(result.map(p => p.name)).toEqual(['Acme', 'Midway', 'Zara']);
  });
});

describe('upsertPayee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('returns an existing payee when the input matches an alias', async () => {
    const payee = { ...makeDbPayee(10, 'Supermarket', {}), aliases: ['Supermarket Legal LLC'] };
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain([payee]));

    const result = await upsertPayee('user-1', 1, ' supermarket legal llc ');

    expect(result.id).toBe(10);
    expect((vi.mocked(db) as any).insert).not.toHaveBeenCalled();
  });
});

describe('updatePayee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  function mockUpdateReturning(row: unknown) {
    const returning = vi.fn().mockResolvedValue([row]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    (vi.mocked(db) as any).update.mockReturnValue({ set });
    return { set };
  }

  it('sanitizes aliases before persisting them', async () => {
    const payee = makeDbPayee(5, 'Supermarket', {});
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain([payee]));
    const update = mockUpdateReturning({ ...payee, aliases: ['Supermarket Legal LLC'] });

    await updatePayee('user-1', 1, 5, {
      aliases: ['  Supermarket  ', ' Supermarket Legal LLC ', 'Supermarket Legal LLC'],
      notes: 'Main grocery merchant',
    });

    expect(update.set).toHaveBeenCalledWith({
      aliases: ['Supermarket Legal LLC'],
      notes: 'Main grocery merchant',
    });
  });

  it('rejects aliases that are already used by another payee', async () => {
    const payees = [makeDbPayee(5, 'Supermarket', {}), { ...makeDbPayee(6, 'Employer', {}), aliases: ['Payroll'] }];
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain(payees));

    await expect(updatePayee('user-1', 1, 5, { aliases: ['Payroll'] })).rejects.toThrow(
      'Alias "Payroll" is already used by another payee',
    );
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
    const payee = makeDbPayee(5, 'Shop', {
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
    const payee = makeDbPayee(5, 'Shop', {
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
