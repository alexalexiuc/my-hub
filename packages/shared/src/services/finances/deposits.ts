/**
 * Deposit account services (fixed-term deposits and bonds; maths lives in utils/deposit.ts)
 * - validateDepositDetails(userId, budgetId, details) — checks a deposit's details and linked accounts; throws DepositError
 * - getDepositInterestReceived(userId, budgetId, account) — net interest logged so far for a deposit
 * - getDepositSummaryForAccount(userId, budgetId, account, opts?) — DepositSummary for a deposit account (null for other types)
 * - openDeposit(userId, budgetId, input) — creates the deposit account and records the funding as a transfer from the source account
 * - recordDepositInterest(userId, budgetId, depositAccountId, input?) — logs one interest payout as net income (gross/tax/net kept in extras)
 * - updateDepositMode(userId, budgetId, depositAccountId, input) — switches payout/capitalization from an effective date, keeping earlier history
 * - closeDeposit(userId, budgetId, depositAccountId, input) — returns the balance by transfer (any forfeited interest booked as an expense), sets matured/broken status and archives the account
 * - getDepositAlertsForBudget(userId, budgetId, asOfDate?) — alerts firing today for every active deposit in a budget
 * - findInterestCategoryId(userId, budgetId) — id of the budget's category named "Interest", if any
 * Types: OpenDepositInput, RecordDepositInterestInput, UpdateDepositModeInput, CloseDepositInput, DepositError
 */
import {
  AccountTypes,
  DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY,
  DepositPayouts,
  DepositStatuses,
  TransactionTypes,
  type DepositCapitalizationFrequency,
  type DepositPayout,
} from '../../constants/finances';
import type { DepositAccountDetails } from '../../types/account-details';
import {
  getAccountDetails,
  type DepositForfeitedInterestTransactionDetails,
  type DepositInterestTransactionDetails,
  type FinanceAccount,
  type FinanceTransaction,
} from '../../types';
import {
  buildDepositSchedule,
  calculateDepositSummary,
  getDepositAlerts,
  getDepositMaturityDate,
  getDepositModeAt,
  getDepositModeSegments,
  type DepositAlert,
  type DepositPayoutEntry,
  type DepositSummary,
} from '../../utils/deposit';
import { currentDateString, isIsoDateStr } from '../../utils/dates';
import { UserInputError } from '../../utils/errors';
import { getAccountById, getAccounts, createAccount, updateAccount } from './accounts';
import { getCategories } from './categories';
import { addTransaction, getTransactions } from './transactions';

/** Invalid deposit input — the message is written for the end user. */
export class DepositError extends UserInputError {
  constructor(message: string) {
    super(message);
    this.name = 'DepositError';
  }
}

export type OpenDepositInput = {
  name: string;
  currency: FinanceAccount['currency'];
  /** Deposit details; `status` is set to active. */
  details: Omit<DepositAccountDetails, 'type' | 'status'>;
  /** Account the principal is moved from. */
  sourceAccountId: number;
  /** Amount leaving the source account, in the source account's currency. Required when currencies differ. */
  sourceAmount?: number;
};

export type RecordDepositInterestInput = {
  /** Payout date; defaults to today. */
  date?: string;
  /** Net interest actually received; defaults to the next scheduled payout not yet received. */
  net?: number;
  /** Tax withheld; defaults to the scheduled tax share (gross − net) or tax rate applied to net. */
  tax?: number;
  categoryId?: number | null;
  notes?: string;
};

export type UpdateDepositModeInput = {
  /** Date the new mode starts; defaults to today. Must fall inside the term, after the current mode began. */
  effectiveDate?: string;
  payout?: DepositPayout;
  /** Only with `payout: capitalized`. Defaults to the current frequency, else monthly. */
  capitalizationFrequency?: DepositCapitalizationFrequency;
  /** Account receiving net interest; required when switching to a paid-out mode and none is set. */
  payoutAccountId?: number;
  /** Assumed % on paid-out interest for the capitalization comparison; null clears it. */
  reinvestRate?: number | null;
};

export type CloseDepositInput = {
  reason: 'matured' | 'broken';
  /** Defaults to today. */
  date?: string;
  /** Broken early: interest the bank claws back, recorded as an expense on the return account. */
  clawbackAmount?: number;
  /**
   * Same currency: the amount the bank actually returns. Less than the balance means the difference is
   * forfeited interest. Different currency: the amount credited to the return account, in its currency.
   */
  returnAmount?: number;
  /** Part of the balance the bank keeps (deposit currency). Derived from `returnAmount` when currencies match. */
  forfeitedAmount?: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function requireDetails(account: FinanceAccount): DepositAccountDetails {
  const details = getAccountDetails('deposit', account.details);
  if (account.type !== AccountTypes.Deposit || !details) throw new DepositError('Not a deposit account');
  return details;
}

/**
 * Validates deposit details and that the linked payout/return accounts exist in the budget and are active.
 * Throws a DepositError describing the first problem.
 */
export async function validateDepositDetails(
  userId: string,
  budgetId: number,
  details: Omit<DepositAccountDetails, 'type' | 'status'> & { type?: 'deposit'; status?: unknown },
): Promise<void> {
  if (!details.institution?.trim()) throw new DepositError('A deposit needs an institution.');
  if (!(details.principal > 0)) throw new DepositError('Principal must be greater than 0.');
  if (!(details.interestRate >= 0)) throw new DepositError('Interest rate cannot be negative.');
  if (!Number.isInteger(details.termMonths) || details.termMonths <= 0) {
    throw new DepositError('Term must be a whole number of months.');
  }
  if (!isIsoDateStr(details.startDate)) throw new DepositError('Start date must be YYYY-MM-DD.');
  if (!(details.taxRate >= 0 && details.taxRate <= 100)) throw new DepositError('Tax rate must be between 0 and 100.');
  if (details.rateType === 'fixed_then_floating' && !(details.fixedMonths && details.fixedMonths > 0)) {
    throw new DepositError('fixed_then_floating deposits need fixedMonths.');
  }
  if (details.capitalizationFrequency != null && details.payout !== DepositPayouts.Capitalized) {
    throw new DepositError('capitalizationFrequency only applies when payout is capitalized.');
  }
  if (details.reinvestRate != null && !(details.reinvestRate >= 0)) {
    throw new DepositError('Reinvestment rate cannot be negative.');
  }
  if (details.payout !== DepositPayouts.Capitalized && details.payoutAccountId == null) {
    throw new DepositError('Pick a payout account (where net interest lands), or use capitalized payout.');
  }
  for (const [label, id] of [
    ['Payout', details.payoutAccountId],
    ['Return', details.returnAccountId],
  ] as const) {
    if (id == null) continue;
    const linked = await getAccountById(userId, budgetId, id);
    if (!linked || linked.archived) throw new DepositError(`${label} account ${id} was not found or is archived.`);
  }
}

/** Net interest logged so far for a deposit (sum of `deposit_interest` transactions that reference it). */
export async function getDepositInterestReceived(
  userId: string,
  budgetId: number,
  account: FinanceAccount,
): Promise<number> {
  const details = requireDetails(account);
  // Interest lands in the payout account, or in the deposit itself while capitalized — a deposit that
  // switched mode has both.
  const accountIds = [...new Set([account.id, details.payoutAccountId ?? account.id])];
  const batches = await Promise.all(
    accountIds.map(accountId =>
      getTransactions(userId, budgetId, { accountId, type: TransactionTypes.Income, includeCorrections: false }),
    ),
  );
  const seen = new Set<number>();
  return batches.flat().reduce((sum, t) => {
    if (seen.has(t.id)) return sum;
    seen.add(t.id);
    return sum + interestNet(t, account.id);
  }, 0);
}

function interestNet(txn: FinanceTransaction, depositAccountId: number): number {
  const extras = txn.extras as { kind?: string; depositAccountId?: number; net?: number } | null;
  return extras?.kind === 'deposit_interest' && extras.depositAccountId === depositAccountId ? (extras.net ?? 0) : 0;
}

/** Returns the DepositSummary for a deposit account, or null for any other account type. */
export async function getDepositSummaryForAccount(
  userId: string,
  budgetId: number,
  account: FinanceAccount,
  opts: { asOfDate?: string } = {},
): Promise<DepositSummary | null> {
  if (account.type !== AccountTypes.Deposit) return null;
  const details = getAccountDetails('deposit', account.details);
  if (!details) return null;
  const interestReceived = await getDepositInterestReceived(userId, budgetId, account);
  return calculateDepositSummary(details, { asOfDate: opts.asOfDate, interestReceived });
}

/** Returns the id of the budget's category named "Interest" (case-insensitive), or null. */
export async function findInterestCategoryId(userId: string, budgetId: number): Promise<number | null> {
  const categories = await getCategories(userId, budgetId);
  return categories.find(c => c.name.trim().toLowerCase() === 'interest')?.id ?? null;
}

/**
 * Creates a deposit account (balance 0) and records the funding as a transfer from the source
 * account on the start date. Unlike loans, no opening-balance correction is made — the money really moves.
 */
export async function openDeposit(
  userId: string,
  budgetId: number,
  input: OpenDepositInput,
): Promise<{ account: FinanceAccount; fundingTransactionId: number }> {
  await validateDepositDetails(userId, budgetId, input.details);
  const source = await getAccountById(userId, budgetId, input.sourceAccountId);
  if (!source || source.archived) throw new DepositError(`Source account ${input.sourceAccountId} was not found.`);
  if (source.currency !== input.currency && input.sourceAmount == null) {
    throw new DepositError(
      `The source account is in ${source.currency} but the deposit is in ${input.currency}: pass sourceAmount (amount leaving the source account).`,
    );
  }

  const account = await createAccount(userId, budgetId, {
    name: input.name,
    type: AccountTypes.Deposit,
    currency: input.currency,
    balance: 0,
    archived: false,
    details: { ...input.details, type: 'deposit', status: DepositStatuses.Active },
  });

  const sameCurrency = source.currency === input.currency;
  const funding = await addTransaction(userId, budgetId, {
    type: TransactionTypes.Transfer,
    accountId: source.id,
    toAccountId: account.id,
    amount: sameCurrency ? input.details.principal : input.sourceAmount!,
    toAmount: sameCurrency ? undefined : input.details.principal,
    date: input.details.startDate,
    categoryId: null,
    payeeId: null,
    notes: `Deposit funding: ${input.name}`,
    source: 'mcp',
  });
  return { account, fundingTransactionId: funding.id };
}

/**
 * Logs one interest period as income of the net amount: into the payout account, or into the deposit
 * itself when that period is capitalized (so its balance and net worth grow). Gross/tax/net are kept in
 * `extras` so interest received can be summed. With no `net`, the next scheduled period not yet covered by
 * received interest is used; its mode decides where the money lands.
 */
export async function recordDepositInterest(
  userId: string,
  budgetId: number,
  depositAccountId: number,
  input: RecordDepositInterestInput = {},
): Promise<{
  transaction: FinanceTransaction;
  net: number;
  tax: number;
  gross: number;
  /** Interest was credited to the deposit itself rather than paid out. */
  capitalized: boolean;
}> {
  const account = await getAccountById(userId, budgetId, depositAccountId);
  if (!account) throw new DepositError('Deposit account not found');
  const details = requireDetails(account);
  if (details.status !== DepositStatuses.Active) throw new DepositError('This deposit is already closed.');

  const date = input.date ?? currentDateString();
  let { net, tax } = input;
  let next: DepositPayoutEntry | undefined;
  if (net == null) {
    const received = await getDepositInterestReceived(userId, budgetId, account);
    let cumulative = 0;
    next = buildDepositSchedule(details).find(e => {
      cumulative += e.net;
      return cumulative - received > 0.01;
    });
    if (!next) throw new DepositError('No scheduled interest left to record — pass net explicitly if needed.');
    net = next.net;
    tax ??= next.tax;
  }
  if (!(net > 0)) throw new DepositError('Interest net amount must be greater than 0.');
  tax ??= details.taxRate < 100 ? Math.round(((net * details.taxRate) / (100 - details.taxRate)) * 100) / 100 : 0;
  const gross = Math.round((net + tax) * 100) / 100;

  const capitalized = next ? next.capitalized : getDepositModeAt(details, date).payout === DepositPayouts.Capitalized;
  const targetId = capitalized ? account.id : details.payoutAccountId;
  if (targetId == null) throw new DepositError('No payout account set — edit the deposit and pick one first.');
  const target = targetId === account.id ? account : await getAccountById(userId, budgetId, targetId);
  if (!target) throw new DepositError('Payout account not found');

  const categoryId = input.categoryId !== undefined ? input.categoryId : await findInterestCategoryId(userId, budgetId);
  const extras: DepositInterestTransactionDetails = {
    kind: 'deposit_interest',
    depositAccountId: account.id,
    gross,
    tax,
    net,
  };
  const transaction = await addTransaction(userId, budgetId, {
    type: TransactionTypes.Income,
    accountId: target.id,
    amount: net,
    amountCurrency: account.currency,
    date,
    categoryId,
    payeeId: null,
    notes: input.notes ?? `Interest: ${account.name}`,
    extras,
    source: 'mcp',
  });
  return { transaction, net, tax, gross, capitalized };
}

/**
 * Closes a deposit: transfers what the bank returns (balance minus any forfeited interest) to the return
 * account, books the forfeited part as an expense in the Interest category on the deposit so its balance
 * reaches 0, optionally records a clawback expense for an early break, sets the status
 * (matured/broken) and archives the account.
 */
export async function closeDeposit(
  userId: string,
  budgetId: number,
  depositAccountId: number,
  input: CloseDepositInput,
): Promise<{
  account: FinanceAccount;
  /** Amount transferred to the return account (deposit currency). */
  returnedAmount: number;
  returnTransactionId: number;
  /** Balance the bank kept (deposit currency); 0 when the full balance came back. */
  forfeitedAmount: number;
  forfeitedTransactionId: number | null;
}> {
  const account = await getAccountById(userId, budgetId, depositAccountId);
  if (!account) throw new DepositError('Deposit account not found');
  const details = requireDetails(account);
  if (details.status !== DepositStatuses.Active) throw new DepositError('This deposit is already closed.');

  const returnId = details.returnAccountId ?? details.payoutAccountId;
  if (returnId == null) throw new DepositError('No return account set — edit the deposit and pick one first.');
  const returnAccount = await getAccountById(userId, budgetId, returnId);
  if (!returnAccount || returnAccount.archived) throw new DepositError('Return account not found or archived.');

  const date = input.date ?? currentDateString();
  const { balance } = account;
  if (!(balance > 0)) throw new DepositError('The deposit has no balance to return.');

  const sameCurrency = returnAccount.currency === account.currency;
  if (!sameCurrency && input.returnAmount == null) {
    throw new DepositError(
      `The return account is in ${returnAccount.currency} but the deposit is in ${account.currency}: pass returnAmount (amount credited to the return account).`,
    );
  }

  const derived = sameCurrency && input.returnAmount != null ? round2(balance - input.returnAmount) : null;
  if (derived != null && derived < 0) {
    throw new DepositError(`returnAmount ${input.returnAmount} is more than the deposit balance ${balance}.`);
  }
  if (derived != null && input.forfeitedAmount != null && Math.abs(derived - input.forfeitedAmount) > 0.01) {
    throw new DepositError(
      'returnAmount and forfeitedAmount disagree: balance − returnAmount must equal forfeitedAmount.',
    );
  }
  const forfeitedAmount = round2(input.forfeitedAmount ?? derived ?? 0);
  if (forfeitedAmount < 0 || forfeitedAmount >= balance) {
    throw new DepositError(
      'Forfeited interest must be between 0 and the deposit balance (the bank must return something).',
    );
  }
  if (forfeitedAmount > 0 && input.reason !== 'broken') {
    throw new DepositError('Only a deposit broken early can forfeit interest — use reason "broken".');
  }

  const returnedAmount = round2(balance - forfeitedAmount);
  const ret = await addTransaction(userId, budgetId, {
    type: TransactionTypes.Transfer,
    accountId: account.id,
    toAccountId: returnAccount.id,
    amount: returnedAmount,
    toAmount: sameCurrency ? undefined : input.returnAmount,
    amountCurrency: account.currency,
    date,
    categoryId: null,
    payeeId: null,
    notes: input.reason === 'matured' ? `Deposit matured: ${account.name}` : `Deposit broken early: ${account.name}`,
    source: 'mcp',
  });

  let forfeitedTransactionId: number | null = null;
  if (forfeitedAmount > 0) {
    const extras: DepositForfeitedInterestTransactionDetails = {
      kind: 'deposit_forfeited_interest',
      depositAccountId: account.id,
      forfeited: forfeitedAmount,
    };
    const forfeit = await addTransaction(userId, budgetId, {
      type: TransactionTypes.Expense,
      accountId: account.id,
      amount: forfeitedAmount,
      amountCurrency: account.currency,
      date,
      categoryId: await findInterestCategoryId(userId, budgetId),
      payeeId: null,
      notes: `Forfeited interest: ${account.name}`,
      extras,
      source: 'mcp',
    });
    forfeitedTransactionId = forfeit.id;
  }

  if (input.reason === 'broken' && input.clawbackAmount && input.clawbackAmount > 0) {
    await addTransaction(userId, budgetId, {
      type: TransactionTypes.Expense,
      accountId: returnAccount.id,
      amount: input.clawbackAmount,
      amountCurrency: account.currency,
      date,
      categoryId: await findInterestCategoryId(userId, budgetId),
      payeeId: null,
      notes: `Interest clawback: ${account.name}`,
      source: 'mcp',
    });
  }

  const updated = await updateAccount(userId, budgetId, account.id, {
    archived: true,
    details: {
      ...details,
      status: input.reason === 'matured' ? DepositStatuses.Matured : DepositStatuses.Broken,
    },
  });
  return { account: updated, returnedAmount, returnTransactionId: ret.id, forfeitedAmount, forfeitedTransactionId };
}

/**
 * Switches an active deposit's payout / capitalization mode from an effective date. The mode in force
 * until then is kept in `modeHistory`, so earlier schedule periods are unchanged and only the remaining
 * schedule is recomputed. Throws a DepositError for a date outside the term or a mode that is not valid.
 */
export async function updateDepositMode(
  userId: string,
  budgetId: number,
  depositAccountId: number,
  input: UpdateDepositModeInput,
): Promise<{
  account: FinanceAccount;
  effectiveDate: string;
  summary: DepositSummary;
  schedule: DepositPayoutEntry[];
}> {
  const account = await getAccountById(userId, budgetId, depositAccountId);
  if (!account) throw new DepositError('Deposit account not found');
  const details = requireDetails(account);
  if (details.status !== DepositStatuses.Active) throw new DepositError('This deposit is already closed.');

  const effectiveDate = input.effectiveDate ?? currentDateString();
  if (!isIsoDateStr(effectiveDate)) throw new DepositError('effectiveDate must be YYYY-MM-DD.');
  const current = getDepositModeSegments(details).at(-1);
  const maturity = getDepositMaturityDate(details);
  if (!current || effectiveDate >= maturity) {
    throw new DepositError(`effectiveDate must be before the maturity date ${maturity}.`);
  }
  if (effectiveDate <= current.from) {
    throw new DepositError(`effectiveDate must be after the current mode started on ${current.from}.`);
  }

  const payout = input.payout ?? details.payout;
  const capitalizationFrequency =
    payout === DepositPayouts.Capitalized
      ? (input.capitalizationFrequency ?? details.capitalizationFrequency ?? DEFAULT_DEPOSIT_CAPITALIZATION_FREQUENCY)
      : undefined;
  if (input.capitalizationFrequency != null && payout !== DepositPayouts.Capitalized) {
    throw new DepositError('capitalizationFrequency only applies when payout is capitalized.');
  }
  const unchanged =
    payout === details.payout &&
    capitalizationFrequency === details.capitalizationFrequency &&
    (input.payoutAccountId == null || input.payoutAccountId === details.payoutAccountId) &&
    input.reinvestRate === undefined;
  if (unchanged) throw new DepositError('Nothing to change: pass a different payout or capitalizationFrequency.');

  const modeChanged = payout !== details.payout || capitalizationFrequency !== details.capitalizationFrequency;
  const next: DepositAccountDetails = {
    ...details,
    payout,
    capitalizationFrequency,
    payoutAccountId: input.payoutAccountId ?? details.payoutAccountId,
    reinvestRate: input.reinvestRate === undefined ? details.reinvestRate : (input.reinvestRate ?? undefined),
    ...(modeChanged
      ? {
          modeEffectiveDate: effectiveDate,
          modeHistory: [
            ...(details.modeHistory ?? []),
            { from: current.from, payout: details.payout, capitalizationFrequency: details.capitalizationFrequency },
          ],
        }
      : {}),
  };
  await validateDepositDetails(userId, budgetId, next);

  const updated = await updateAccount(userId, budgetId, account.id, { details: next });
  const summary = (await getDepositSummaryForAccount(userId, budgetId, updated))!;
  return { account: updated, effectiveDate, summary, schedule: buildDepositSchedule(next) };
}

export interface DepositAlertGroup {
  accountId: number;
  accountName: string;
  currency: string;
  alerts: DepositAlert[];
}

/** Returns the alerts firing on `asOfDate` (default today) for each active deposit in the budget; deposits with none are omitted. */
export async function getDepositAlertsForBudget(
  userId: string,
  budgetId: number,
  asOfDate: string = currentDateString(),
): Promise<DepositAlertGroup[]> {
  const accounts = await getAccounts(userId, budgetId);
  const groups: DepositAlertGroup[] = [];
  for (const account of accounts) {
    const details = getAccountDetails('deposit', account.details);
    if (account.type !== AccountTypes.Deposit || !details || details.status !== DepositStatuses.Active) continue;
    const received = await getDepositInterestReceived(userId, budgetId, account);
    const alerts = getDepositAlerts(details, received, { asOfDate });
    if (alerts.length > 0) {
      groups.push({ accountId: account.id, accountName: account.name, currency: account.currency, alerts });
    }
  }
  return groups;
}
