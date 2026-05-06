/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseApiRate, getExchangeRate } from './exchangeRates';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

import { db } from '../../db/client.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a select chain mock that resolves to `rows` at any point in the chain.
 * Supports both `.where().limit()` and `.where().orderBy().limit()` patterns.
 */
function makeSelectChain(rows: unknown[]) {
  function makeThenable(): any {
    const p = Promise.resolve(rows);
    return Object.assign(p, {
      from: vi.fn().mockImplementation(() => makeThenable()),
      where: vi.fn().mockImplementation(() => makeThenable()),
      orderBy: vi.fn().mockImplementation(() => makeThenable()),
      limit: vi.fn().mockResolvedValue(rows),
    });
  }
  return makeThenable();
}

/** Mocks db.insert(...).values(...).onConflictDoNothing() to resolve normally. */
function mockInsert() {
  (vi.mocked(db) as any).insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
    }),
  });
}

// ─── parseApiRate ─────────────────────────────────────────────────────────────

describe('parseApiRate', () => {
  it('returns null for null payload', () => {
    expect(parseApiRate(null, 'eur', 'usd')).toBeNull();
  });

  it('returns null when payload is not an object (string)', () => {
    expect(parseApiRate('not-an-object', 'eur', 'usd')).toBeNull();
  });

  it('returns null when from-currency key is missing', () => {
    expect(parseApiRate({ usd: { eur: 0.92 } }, 'eur', 'usd')).toBeNull();
  });

  it('returns null when rate is 0', () => {
    expect(parseApiRate({ eur: { usd: 0 } }, 'eur', 'usd')).toBeNull();
  });

  it('returns null when rate is negative', () => {
    expect(parseApiRate({ eur: { usd: -1.2 } }, 'eur', 'usd')).toBeNull();
  });

  it('returns null when rate is non-finite (NaN)', () => {
    expect(parseApiRate({ eur: { usd: NaN } }, 'eur', 'usd')).toBeNull();
  });

  it('returns the rate when it is a valid positive number', () => {
    expect(parseApiRate({ eur: { usd: 1.08 } }, 'eur', 'usd')).toBe(1.08);
  });

  it('parses and returns a numeric string rate', () => {
    expect(parseApiRate({ eur: { usd: '1.08' } }, 'eur', 'usd')).toBe(1.08);
  });
});

// ─── getExchangeRate ──────────────────────────────────────────────────────────

describe('getExchangeRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the internal PromiseCacheX between tests by always providing a fresh
    // key (different date string) so cached entries from previous tests don't leak.
  });

  it('returns 1 immediately when from and to are the same currency', async () => {
    const rate = await getExchangeRate('USD', 'USD', '2020-01-01');

    expect(rate).toBe(1);
    expect((vi.mocked(db) as any).select).not.toHaveBeenCalled();
  });

  it('returns rate from DB when an exact row exists', async () => {
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain([{ rate: 1.23 }]));

    const rate = await getExchangeRate('EUR', 'GBP', '2021-06-01');

    expect(rate).toBe(1.23);
  });

  it('fetches from API when DB has no exact row and persists result', async () => {
    // First select (exact DB): miss. Second select (recent DB): not reached.
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain([]));
    mockInsert();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ron: { eur: 0.2 } }),
    } as any);

    const rate = await getExchangeRate('RON', 'EUR', '2022-03-15');

    expect(rate).toBe(0.2);
    expect((vi.mocked(db) as any).insert).toHaveBeenCalled();
  });

  it('falls back to most recent DB row when API returns nothing', async () => {
    let selectCall = 0;
    (vi.mocked(db) as any).select.mockImplementation(() => {
      selectCall++;
      // First call: exact row → miss; second call: recent row → hit
      if (selectCall === 1) return makeSelectChain([]);
      return makeSelectChain([{ rate: 1.55 }]);
    });

    global.fetch = vi.fn().mockResolvedValue({ ok: false } as any);

    const rate = await getExchangeRate('CHF', 'PLN', '2023-07-20');

    expect(rate).toBe(1.55);
  });

  it('returns 1.0 when DB and API both have no data', async () => {
    (vi.mocked(db) as any).select.mockReturnValue(makeSelectChain([]));
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const rate = await getExchangeRate('AED', 'KRW', '2024-11-01');

    expect(rate).toBe(1);
  });
});
