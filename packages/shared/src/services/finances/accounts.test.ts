/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateAccountBalance } from './accounts';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

import { db } from '../../db/client.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mock db.select() to return successive row arrays on each call.
 * recalculateAccountBalance calls select() three times:
 *   1. fetch account row  (resolves at .where())
 *   2. fetch fromEffect   (resolves at .where())
 *   3. fetch toEffect     (resolves at .where())
 */
function mockSelectSequence(results: unknown[][]) {
  let callIndex = 0;
  vi.mocked(db).select.mockImplementation(() => {
    const rows = results[callIndex++] ?? [];
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rows),
    } as any;
  });
}

function mockUpdate() {
  const setCalls: unknown[] = [];
  vi.mocked(db).update.mockImplementation(() => ({
    // @ts-expect-error test mock
    set: vi.fn((data: unknown) => {
      setCalls.push(data);
      return { where: vi.fn().mockResolvedValue([]) };
    }),
  })) as any;
  return setCalls;
}

// ─── recalculateAccountBalance — loan account ─────────────────────────────────
//
// Fixture from production DB (account id 24, SENA Headset) — after fix applied:
//
//   finance_accounts row:
//     id=24, opening_balance=-7500, balance=-7500 at creation (negative = debt)
//     details: { type:"loan", principal:7500, startDate:"2026-05-05",
//                termMonths:6, interestRate:0 }
//
//   finance_transactions row (id=10012):
//     type=transfer, account_id=11 (bank), to_account_id=24 (loan)
//     amount=1250, to_exchange_rate=1.0, is_correction=false
//
// Convention: loan balance is stored negative (you owe -7500). Each repayment is a
// transfer TO the loan that adds a positive amount, moving the balance toward 0.
//
// fromEffect query — WHERE accountId = 24:
//   No matching rows (payment sits on account_id=11, not 24).
//   → net = 0
//
// toEffect query — WHERE toAccountId = 24 AND type = 'transfer':
//   One row: 1250 * toExchangeRate(1.0) = 1250
//   → net = 1250
//
// newBalance = openingBalance + fromEffect + toEffect
//            = -7500 + 0 + 1250 = -6250   (still owes 6250)

describe('recalculateAccountBalance — loan account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reduces negative balance toward zero with each repayment transfer', async () => {
    mockSelectSequence([
      // call 1 — account row (openingBalance = -principal = -7500)
      [{ name: 'SENA', openingBalance: -7500, balance: -7500 }],
      // call 2 — fromEffect: no income/expense directly on loan account
      [{ net: 0 }],
      // call 3 — toEffect: one repayment transfer of 1250
      [{ net: 1250 }],
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -7500, newBalance: -6250 });
    expect(setCalls[0]).toMatchObject({ balance: -6250 });
  });

  it('returns null when the account does not exist', async () => {
    mockSelectSequence([[]]);
    mockUpdate();

    const result = await recalculateAccountBalance(99999);

    expect(result).toBeNull();
    expect(vi.mocked(db).update).not.toHaveBeenCalled();
  });

  it('reaches zero balance when fully repaid', async () => {
    mockSelectSequence([
      [{ name: 'SENA', openingBalance: -7500, balance: -1250 }],
      [{ net: 0 }],
      [{ net: 7500 }], // six payments of 1250 (6 × 1250 = 7500)
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -1250, newBalance: 0 });
    expect(setCalls[0]).toMatchObject({ balance: 0 });
  });

  it('accumulates multiple repayment transfers correctly', async () => {
    mockSelectSequence([
      [{ name: 'SENA', openingBalance: -7500, balance: -7500 }],
      [{ net: 0 }],
      [{ net: 2500 }], // two payments of 1250
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -7500, newBalance: -5000 });
    expect(setCalls[0]).toMatchObject({ balance: -5000 });
  });

  it('applies toExchangeRate — foreign-currency repayment converted to loan currency', async () => {
    // A USD payment of 1250 converted at 0.056 USD/MDL → 70 MDL credited to the loan
    mockSelectSequence([
      [{ name: 'SENA', openingBalance: -7500, balance: -7500 }],
      [{ net: 0 }],
      [{ net: 70 }], // 1250 * 0.056, already computed by the SQL SUM expression
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -7500, newBalance: -7430 });
    expect(setCalls[0]).toMatchObject({ balance: -7430 });
  });

  it('reports no change when the stored balance is already correct', async () => {
    mockSelectSequence([[{ name: 'SENA', openingBalance: -7500, balance: -6250 }], [{ net: 0 }], [{ net: 1250 }]]);
    mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -6250, newBalance: -6250 });
  });

  it('includes correction transactions in fromEffect (user-applied adjustments count)', async () => {
    // User added a correction income of 200 directly on the loan account
    mockSelectSequence([
      [{ name: 'SENA', openingBalance: -7500, balance: -7500 }],
      [{ net: 200 }], // correction income on account 24
      [{ net: 1250 }], // repayment transfer
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    // -7500 + 200 (correction) + 1250 (repayment) = -6050
    expect(result).toEqual({ name: 'SENA', oldBalance: -7500, newBalance: -6050 });
    expect(setCalls[0]).toMatchObject({ balance: -6050 });
  });
});
