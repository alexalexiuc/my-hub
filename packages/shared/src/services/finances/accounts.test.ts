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
// Fixture: loan account id 24, SENA Headset, principal 7500.
//
//   finance_accounts row:
//     id=24, balance=-7500 at creation (opening_balance column removed)
//     details: { type:"loan", principal:7500, startDate:"2026-05-05",
//                termMonths:6, interestRate:0 }
//
//   finance_transactions rows:
//     id=10011: type=expense, is_correction=true, account_id=24, amount=7500
//               (initial balance correction tx — represents the loan disbursement)
//     id=10012: type=transfer, account_id=11 (bank), to_account_id=24 (loan)
//               amount=1250, to_exchange_rate=1.0, is_correction=false
//
// Convention: loan balance is negative (you owe). Each repayment is a transfer
// TO the loan adding a positive amount, moving the balance toward 0.
//
// fromEffect query — WHERE accountId = 24:
//   id=10011: expense correction of 7500 → -7500
//   → net = -7500
//
// toEffect query — WHERE toAccountId = 24 AND type = 'transfer':
//   id=10012: 1250 * toExchangeRate(1.0) = 1250
//   → net = 1250
//
// newBalance = fromEffect + toEffect
//            = -7500 + 1250 = -6250   (still owes 6250)

describe('recalculateAccountBalance — loan account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reduces negative balance toward zero with each repayment transfer', async () => {
    mockSelectSequence([
      // call 1 — account row
      [{ name: 'SENA', balance: -7500 }],
      // call 2 — fromEffect: initial correction expense of 7500
      [{ net: -7500 }],
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
      [{ name: 'SENA', balance: -1250 }],
      [{ net: -7500 }], // initial correction expense
      [{ net: 7500 }], // six payments of 1250 (6 × 1250 = 7500)
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -1250, newBalance: 0 });
    expect(setCalls[0]).toMatchObject({ balance: 0 });
  });

  it('accumulates multiple repayment transfers correctly', async () => {
    mockSelectSequence([
      [{ name: 'SENA', balance: -7500 }],
      [{ net: -7500 }], // initial correction expense
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
      [{ name: 'SENA', balance: -7500 }],
      [{ net: -7500 }], // initial correction expense
      [{ net: 70 }], // 1250 * 0.056, already computed by the SQL SUM expression
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -7500, newBalance: -7430 });
    expect(setCalls[0]).toMatchObject({ balance: -7430 });
  });

  it('reports no change when the stored balance is already correct', async () => {
    mockSelectSequence([[{ name: 'SENA', balance: -6250 }], [{ net: -7500 }], [{ net: 1250 }]]);
    mockUpdate();

    const result = await recalculateAccountBalance(24);

    expect(result).toEqual({ name: 'SENA', oldBalance: -6250, newBalance: -6250 });
  });

  it('includes correction transactions in fromEffect (user-applied adjustments count)', async () => {
    // User added a correction income of 200 directly on the loan account (on top of the initial -7500)
    mockSelectSequence([
      [{ name: 'SENA', balance: -7500 }],
      [{ net: -7300 }], // initial correction expense (-7500) + correction income (+200)
      [{ net: 1250 }], // repayment transfer
    ]);
    const setCalls = mockUpdate();

    const result = await recalculateAccountBalance(24);

    // -7300 (corrections) + 1250 (repayment) = -6050
    expect(result).toEqual({ name: 'SENA', oldBalance: -7500, newBalance: -6050 });
    expect(setCalls[0]).toMatchObject({ balance: -6050 });
  });
});
