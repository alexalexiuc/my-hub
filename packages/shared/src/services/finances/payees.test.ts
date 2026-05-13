/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findPayeeByNameOrAlias, getPayees, mergePayees } from './payees';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDbPayee(id: number, name: string, aliases: string[] = []) {
  return { id, name, aliases, description: null, normalizedName: name.toLowerCase(), budgetId: 1 };
}

function makeTx(payeeId: number, date: string, categoryId: number | null = null, accountId: number | null = null) {
  return { payeeId, date, categoryId, accountId };
}

/**
 * Mocks db.select() to return different rows on successive calls.
 * getPayees() calls select() twice: first for payees (resolves at orderBy),
 * then for recent transactions (resolves at limit).
 */
function mockGetPayeesQueries(payees: unknown[], transactions: unknown[]) {
  const payeesChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(payees),
  };

  const txChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(transactions),
  };

  (vi.mocked(db) as any).select.mockReturnValueOnce(payeesChain).mockReturnValueOnce(txChain);
}

// ─── getPayees — sort order ───────────────────────────────────────────────────

describe('getPayees sort order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('places payee with higher useCount first', async () => {
    const payees = [makeDbPayee(1, 'Alpha'), makeDbPayee(2, 'Beta')];
    // Beta appears 5 times, Alpha 2 times in recent transactions
    const transactions = [
      makeTx(2, '2026-01-10'),
      makeTx(2, '2026-01-09'),
      makeTx(2, '2026-01-08'),
      makeTx(2, '2026-01-07'),
      makeTx(2, '2026-01-06'),
      makeTx(1, '2026-01-05'),
      makeTx(1, '2026-01-04'),
    ];
    mockGetPayeesQueries(payees, transactions);

    const result = await getPayees('user-1', 1);

    expect(result[0]?.name).toBe('Beta');
    expect(result[1]?.name).toBe('Alpha');
  });

  it('places payee with more recent lastUsedAt first when useCount is tied', async () => {
    const payees = [makeDbPayee(1, 'Alpha'), makeDbPayee(2, 'Beta')];
    // Both appear 3 times; Beta's most recent date is later
    const transactions = [
      makeTx(1, '2026-01-01'),
      makeTx(1, '2025-12-01'),
      makeTx(1, '2025-11-01'),
      makeTx(2, '2026-03-15'),
      makeTx(2, '2026-02-01'),
      makeTx(2, '2026-01-15'),
    ];
    mockGetPayeesQueries(payees, transactions);

    const result = await getPayees('user-1', 1);

    expect(result[0]?.name).toBe('Beta');
    expect(result[1]?.name).toBe('Alpha');
  });

  it('places payee with a lastUsedAt before payee with null', async () => {
    const payees = [makeDbPayee(1, 'Alpha'), makeDbPayee(2, 'Beta')];
    // Alpha has no transactions; Beta has one
    const transactions = [makeTx(2, '2026-02-01')];
    mockGetPayeesQueries(payees, transactions);

    const result = await getPayees('user-1', 1);

    expect(result[0]?.name).toBe('Beta');
    expect(result[1]?.name).toBe('Alpha');
  });

  it('sorts alphabetically by name when no recent transactions exist', async () => {
    const payees = [makeDbPayee(1, 'Zara'), makeDbPayee(2, 'Acme', ['Acme LLC']), makeDbPayee(3, 'Midway')];
    mockGetPayeesQueries(payees, []);

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
    const payees = [makeDbPayee(2, 'Acme', ['Acme SRL', 'Acme Corp'])];
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

// ─── mergePayees ─────────────────────────────────────────────────────────────

describe('mergePayees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasAccessToBudget).mockResolvedValue(true);
  });

  it('throws when the target payee is missing inside the transaction', async () => {
    const source = makeDbPayee(31, 'Source');

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
