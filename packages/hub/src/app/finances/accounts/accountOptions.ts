import { AccountTypes, DepositInstruments, DepositPayouts, LentDirections } from '@my-hub/shared/constants';

export const ACCOUNT_TYPE_OPTIONS = [
  { id: AccountTypes.Bank, value: '🏦 Bank' },
  { id: AccountTypes.Investment, value: '📈 Investment' },
  { id: AccountTypes.CreditCard, value: '💳 Credit Card' },
  { id: AccountTypes.Loan, value: '🏷 Loan' },
  { id: AccountTypes.Deposit, value: '🔒 Deposit' },
  { id: AccountTypes.Goal, value: '🎯 Goal' },
  { id: AccountTypes.Cash, value: '💵 Cash' },
  { id: AccountTypes.Tracking, value: '👁 Tracking' },
  { id: AccountTypes.BorrowedLent, value: '🤝 Borrowed / Lent' },
];

export const DEPOSIT_INSTRUMENT_OPTIONS = [
  { id: DepositInstruments.BankDeposit, value: 'Bank deposit' },
  { id: DepositInstruments.StateBond, value: 'State bond' },
];

export const DEPOSIT_PAYOUT_OPTIONS = [
  { id: DepositPayouts.Monthly, value: 'Monthly' },
  { id: DepositPayouts.Quarterly, value: 'Quarterly' },
  { id: DepositPayouts.Semiannual, value: 'Every 6 months' },
  { id: DepositPayouts.AtMaturity, value: 'At maturity' },
  { id: DepositPayouts.Capitalized, value: 'Capitalized (added to balance)' },
];

export const DIRECTION_OPTIONS = [
  { id: LentDirections.Gave, value: 'Lent (gave)' },
  { id: LentDirections.Received, value: 'Borrowed (received)' },
];
