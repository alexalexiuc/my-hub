/**
 * Transaction money resolution — turns what the user entered into the stored money fields.
 * Single owner of the multi-currency rules shared by add/update transaction paths:
 *   - amount is always in the source account's currency (input in another currency is converted
 *     at a user-entered rate or the transaction-date market rate; the original is kept in extras.conversion)
 *   - transfers carry toAmount in the destination account's currency; a cross-currency transfer
 *     without it is rejected (unless the input was entered in the destination currency)
 *   - reportingAmount is the budget-default-currency value, frozen at write time
 * - resolveTransactionMoney(input) — computes amount, conversion, toAmount, toExchangeRate, reportingAmount, exchangeRate
 * - withConversion(extras, conversion) — returns extras with conversion set or removed
 * - transferToAmount(t) — destination leg of a stored transfer (toAmount, or amount × toExchangeRate for legacy rows)
 * - transferToAmountSql — SQL fragment for the same destination leg, for aggregate queries
 * - getOriginalInput(extras) — the originally typed amount/currency/rate of a converted entry, or null
 * - round4(n) — rounds to the 4-decimal scale used by money columns
 * - TransactionMoneyError — UserInputError for invalid money input (Hub → 400, MCP → handled tool error)
 * Types: TransactionMoneyInput, ResolvedTransactionMoney
 */
import { sql } from 'drizzle-orm';
import { financeTransactions } from '../../db/schema/finances';
import { FxRateSources, TransactionTypes, type FxRateSource, type TransactionType } from '../../constants/finances';
import type { TransactionConversionMeta, TransactionDetails } from '../../types';
import { UserInputError } from '../../utils/errors';
import { ExchangeRateUnavailableError, getExchangeRateQuote } from './exchangeRates';

/** Invalid money input — the message is written for the end user. */
export class TransactionMoneyError extends UserInputError {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionMoneyError';
  }
}

export interface TransactionMoneyInput {
  type: TransactionType;
  /** YYYY-MM-DD transaction date — the date FX rates are looked up for. */
  date: string;
  /** Amount as entered, denominated in inputCurrency. */
  inputAmount: number;
  /** Currency of inputAmount. Omit/null when it is the source account's currency. */
  inputCurrency?: string | null;
  /** User-entered rate: 1 inputCurrency = rate × account currency. Only valid when inputCurrency differs. */
  rate?: number | null;
  /** Transfers only: amount credited to the destination account, in its currency. */
  toAmount?: number | null;
  accountCurrency: string;
  /** Transfers only: destination account currency. */
  toAccountCurrency?: string | null;
  budgetCurrency: string;
  /** Balance corrections: the reporting value is best-effort (never blocks the correction). */
  isCorrection?: boolean;
  /**
   * Update path: a previously stored conversion whose rate is reused when no new rate is given and
   * the currency pair and date are unchanged — so editing notes/amount keeps a user-entered rate.
   */
  reuseConversion?: TransactionConversionMeta | null;
}

export interface ResolvedTransactionMoney {
  /** In the source account's currency. */
  amount: number;
  /** Set when the input was in another currency; null otherwise. */
  conversion: TransactionConversionMeta | null;
  /** Transfers: destination leg in the destination account's currency; null otherwise. */
  toAmount: number | null;
  /** Transfers: toAmount / amount; null otherwise. */
  toExchangeRate: number | null;
  /** In the budget's default currency. */
  reportingAmount: number;
  /** reportingAmount / amount — kept for legacy readers of the exchangeRate column. */
  exchangeRate: number;
}

/**
 * Account → budget currency rate for the reporting value. Corrections accept any known rate and
 * return null instead of failing when none exists; everything else uses the strict lookup.
 */
async function quoteReportingRate(
  accountCurrency: string,
  budgetCurrency: string,
  date: string,
  isCorrection: boolean,
): Promise<{ rate: number } | null> {
  if (!isCorrection) return getExchangeRateQuote(accountCurrency, budgetCurrency, date);
  try {
    return await getExchangeRateQuote(accountCurrency, budgetCurrency, date, { maxAgeDays: Infinity });
  } catch (err) {
    if (err instanceof ExchangeRateUnavailableError) return null;
    throw err;
  }
}

/** Destination leg of a stored transfer, in the destination currency (legacy rows fall back to amount × toExchangeRate). */
export function transferToAmount(t: {
  amount: number;
  toAmount: number | null;
  toExchangeRate: number | null;
}): number {
  return t.toAmount ?? round4(t.amount * (t.toExchangeRate ?? 1));
}

/** SQL twin of transferToAmount — the destination leg of a transfer row, in the destination currency. */
export const transferToAmountSql = sql<number>`COALESCE(${financeTransactions.toAmount}, ${financeTransactions.amount} * COALESCE(${financeTransactions.toExchangeRate}, 1))`;

/** What the user originally typed when the amount was converted (null when entered in the account currency). */
export function getOriginalInput(
  extras: TransactionDetails | null | undefined,
): { amount: number; currency: string; rate: number; rateSource: FxRateSource | null; rateDate: string | null } | null {
  const c = extras?.conversion;
  if (c?.originalAmount == null || !c.originalCurrency || c.originalToAccountRate == null) return null;
  return {
    amount: c.originalAmount,
    currency: c.originalCurrency,
    rate: c.originalToAccountRate,
    rateSource: c.rateSource ?? null,
    rateDate: c.rateDate ?? null,
  };
}

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length === 3 ? normalized : null;
}

/** Returns extras with `conversion` replaced (or removed when null), creating a base shape if needed. */
export function withConversion(
  extras: TransactionDetails | null | undefined,
  conversion: TransactionConversionMeta | null,
): TransactionDetails | null {
  if (conversion == null) {
    if (extras?.conversion == null) return extras ?? null;
    const { conversion: _removed, ...rest } = extras;
    return rest as TransactionDetails;
  }
  return { ...(extras ?? { kind: 'base' }), conversion };
}

/**
 * Applies the multi-currency rules to one transaction's money input. Looks up market rates only
 * when needed (strict lookups — throws instead of guessing when no rate is available).
 */
export async function resolveTransactionMoney(input: TransactionMoneyInput): Promise<ResolvedTransactionMoney> {
  const { type, date, accountCurrency, budgetCurrency } = input;
  const isTransfer = type === TransactionTypes.Transfer;

  if (!Number.isFinite(input.inputAmount) || input.inputAmount < 0) {
    throw new TransactionMoneyError('Amount must be a non-negative number.');
  }
  if (input.rate != null && !(Number.isFinite(input.rate) && input.rate > 0)) {
    throw new TransactionMoneyError('Exchange rate must be a positive number.');
  }
  if (input.toAmount != null && !(Number.isFinite(input.toAmount) && input.toAmount >= 0)) {
    throw new TransactionMoneyError('Received amount (toAmount) must be a non-negative number.');
  }
  if (!isTransfer && input.toAmount != null) {
    throw new TransactionMoneyError('toAmount can only be set on transfers.');
  }

  const inputCurrency = normalizeCurrencyCode(input.inputCurrency) ?? accountCurrency;
  const inputAmount = round4(input.inputAmount);

  // ── Source leg: convert into the account currency when entered in another currency ──
  let amount = inputAmount;
  let conversion: TransactionConversionMeta | null = null;

  if (inputCurrency !== accountCurrency) {
    const reuse = input.reuseConversion;
    const canReuse =
      input.rate == null &&
      reuse?.originalToAccountRate != null &&
      reuse.originalToAccountRate > 0 &&
      normalizeCurrencyCode(reuse.originalCurrency) === inputCurrency &&
      normalizeCurrencyCode(reuse.accountCurrency) === accountCurrency;

    let rate: number;
    let rateMeta: Pick<TransactionConversionMeta, 'rateSource' | 'rateDate'>;
    if (input.rate != null) {
      rate = input.rate;
      rateMeta = { rateSource: FxRateSources.User };
    } else if (canReuse) {
      rate = reuse!.originalToAccountRate!;
      rateMeta = { rateSource: reuse!.rateSource, rateDate: reuse!.rateDate };
    } else {
      const quote = await getExchangeRateQuote(inputCurrency, accountCurrency, date);
      rate = quote.rate;
      rateMeta = { rateSource: FxRateSources.Market, rateDate: quote.rateDate };
    }

    amount = round4(inputAmount * rate);
    conversion = {
      originalAmount: inputAmount,
      originalCurrency: inputCurrency,
      accountCurrency,
      originalToAccountRate: rate,
      convertedAmount: amount,
      ...Object.fromEntries(Object.entries(rateMeta).filter(([, v]) => v !== undefined)),
    };
  } else if (input.rate != null) {
    throw new TransactionMoneyError(
      `A rate only applies when the amount is in a different currency than the account (${accountCurrency}).`,
    );
  }

  // ── Destination leg ──
  let toAmount: number | null = null;
  let toExchangeRate: number | null = null;

  if (isTransfer) {
    const toCurrency = normalizeCurrencyCode(input.toAccountCurrency);
    if (toCurrency == null) throw new TransactionMoneyError('Transfer destination account currency is unknown.');

    if (toCurrency === accountCurrency) {
      if (input.toAmount != null && Math.abs(round4(input.toAmount) - amount) >= 0.00005) {
        throw new TransactionMoneyError(
          `Both accounts are in ${accountCurrency}, so the received amount must equal the sent amount (${amount}).`,
        );
      }
      toAmount = amount;
    } else if (input.toAmount != null) {
      toAmount = round4(input.toAmount);
    } else if (conversion != null && inputCurrency === toCurrency) {
      // Entered in the destination currency (e.g. "300 EUR into the EUR wallet") — that is what arrives.
      toAmount = inputAmount;
    } else {
      throw new TransactionMoneyError(
        `Transfer from ${accountCurrency} to ${toCurrency}: provide the amount received in ${toCurrency} (toAmount).`,
      );
    }
    toExchangeRate = amount > 0 ? round8(toAmount / amount) : null;
  }

  // ── Reporting value in the budget currency, frozen at write time ──
  let reportingAmount = amount;
  let exchangeRate = 1;
  if (accountCurrency !== budgetCurrency) {
    if (isTransfer && toAmount != null && normalizeCurrencyCode(input.toAccountCurrency) === budgetCurrency) {
      reportingAmount = toAmount; // the budget-currency leg is the exact value
    } else if (conversion != null && inputCurrency === budgetCurrency) {
      reportingAmount = inputAmount; // entered in the budget currency — exact value
    } else {
      const quote = await quoteReportingRate(accountCurrency, budgetCurrency, date, input.isCorrection === true);
      // Corrections never enter a reporting sum, so a missing rate must not block them (e.g. an
      // opening balance on a new foreign-currency account): their reporting value is left at 0.
      reportingAmount = quote ? round4(amount * quote.rate) : 0;
      exchangeRate = quote?.rate ?? 0;
    }
    if (exchangeRate === 1 && amount > 0) exchangeRate = round8(reportingAmount / amount);
  }

  return { amount, conversion, toAmount, toExchangeRate, reportingAmount, exchangeRate };
}
