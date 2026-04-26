'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { AccountTypes, LentDirections } from '@my-hub/shared/constants';

const ACCOUNT_TYPE_OPTIONS = [
  { value: AccountTypes.Bank, label: '🏦 Bank' },
  { value: AccountTypes.Investment, label: '📈 Investment' },
  { value: AccountTypes.CreditCard, label: '💳 Credit Card' },
  { value: AccountTypes.Loan, label: '🏷 Loan' },
  { value: AccountTypes.Goal, label: '🎯 Goal' },
  { value: AccountTypes.Cash, label: '💵 Cash' },
  { value: AccountTypes.Tracking, label: '👁 Tracking' },
  { value: AccountTypes.BorrowedLent, label: '🤝 Borrowed / Lent' },
] as const;

type AddAccountModalProps = {
  defaultCurrency: string;
  onClose: () => void;
  onCreated: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.08em] text-[var(--fin-subtle)]">{label}</label>
      {children}
    </div>
  );
}

const inputClassName =
  'w-full rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] px-2.5 py-[7px] text-[13px] text-[var(--fin-text)] outline-none';

export function AddAccountModal({ defaultCurrency, onClose, onCreated }: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(AccountTypes.Bank);
  const currency = defaultCurrency;
  const [openingBalance, setOpeningBalance] = useState('0');
  const [saving, setSaving] = useState(false);

  // Credit card
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [cardLastFour, setCardLastFour] = useState('');
  const [cardName, setCardName] = useState('');

  // Goal
  const [targetAmount, setTargetAmount] = useState('');

  // Investment
  const [deposited, setDeposited] = useState('0');

  // Loan
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [loanStartDate, setLoanStartDate] = useState('');
  const [linkedItemName, setLinkedItemName] = useState('');

  // Borrowed/Lent
  const [counterpartyName, setCounterpartyName] = useState('');
  const [direction, setDirection] = useState<string>(LentDirections.Gave);
  const [dueDate, setDueDate] = useState('');

  // Bank extras
  const [bankCardLastFour, setBankCardLastFour] = useState('');
  const [bankCardName, setBankCardName] = useState('');

  function buildDetails(): object | null {
    switch (type) {
      case AccountTypes.Bank:
        return {
          ...(bankCardLastFour ? { cardLastFour: bankCardLastFour } : {}),
          ...(bankCardName ? { cardName: bankCardName } : {}),
        };
      case AccountTypes.CreditCard:
        return {
          creditLimit: parseFloat(creditLimit) || 0,
          statementDay: parseInt(statementDay) || 1,
          ...(cardLastFour ? { cardLastFour } : {}),
          ...(cardName ? { cardName } : {}),
        };
      case AccountTypes.Goal:
        return { targetAmount: parseFloat(targetAmount) || 0 };
      case AccountTypes.Investment:
        return { deposited: parseFloat(deposited) || 0 };
      case AccountTypes.Loan:
        return {
          principal: parseFloat(principal) || 0,
          interestRate: parseFloat(interestRate) || 0,
          termMonths: parseInt(termMonths) || 0,
          startDate: loanStartDate || new Date().toISOString().slice(0, 10),
          ...(linkedItemName ? { linkedItemName } : {}),
        };
      case AccountTypes.BorrowedLent:
        return {
          counterpartyName,
          direction,
          ...(dueDate ? { dueDate } : {}),
          settled: false,
        };
      case AccountTypes.Cash:
      case AccountTypes.Tracking:
      default:
        return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await apiFetch('/api/finances/accounts', {
      method: 'POST',
      body: {
        name: name.trim(),
        type,
        currency: currency.trim().toUpperCase(),
        openingBalance: parseFloat(openingBalance) || 0,
        details: buildDetails(),
      },
    });
    setSaving(false);
    onCreated();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{
        background: 'var(--fin-overlay)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-[14px] border border-[var(--fin-border)] bg-[var(--fin-card)] p-5"
      >
        <div className="mb-4 text-base font-bold text-[var(--fin-text)]">New Account</div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <input
              className={inputClassName}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Salary"
              autoFocus
              required
            />
          </Field>

          <Field label="Type">
            <select className={inputClassName} value={type} onChange={e => setType(e.target.value)}>
              {ACCOUNT_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Opening Balance">
            <input
              className={inputClassName}
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
            />
          </Field>

          {/* Credit Card extras */}
          {type === AccountTypes.CreditCard && (
            <>
              <Field label="Credit Limit">
                <input
                  className={inputClassName}
                  type="number"
                  step="0.01"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  placeholder="5000"
                />
              </Field>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <Field label="Statement Day">
                    <input
                      className={inputClassName}
                      type="number"
                      min={1}
                      max={31}
                      value={statementDay}
                      onChange={e => setStatementDay(e.target.value)}
                      placeholder="1"
                    />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Last 4 Digits">
                    <input
                      className={inputClassName}
                      maxLength={4}
                      value={cardLastFour}
                      onChange={e => setCardLastFour(e.target.value)}
                      placeholder="1234"
                    />
                  </Field>
                </div>
              </div>
              <Field label="Card Name (optional)">
                <input
                  className={inputClassName}
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  placeholder="Visa Platinum"
                />
              </Field>
            </>
          )}

          {/* Bank extras */}
          {type === AccountTypes.Bank && (
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Last 4 Digits (optional)">
                  <input
                    className={inputClassName}
                    maxLength={4}
                    value={bankCardLastFour}
                    onChange={e => setBankCardLastFour(e.target.value)}
                    placeholder="1234"
                  />
                </Field>
              </div>
              <div className="flex-[2]">
                <Field label="Card Name (optional)">
                  <input
                    className={inputClassName}
                    value={bankCardName}
                    onChange={e => setBankCardName(e.target.value)}
                    placeholder="Debit card"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Goal extras */}
          {type === AccountTypes.Goal && (
            <Field label="Target Amount">
              <input
                className={inputClassName}
                type="number"
                step="0.01"
                value={targetAmount}
                onChange={e => setTargetAmount(e.target.value)}
                placeholder="10000"
              />
            </Field>
          )}

          {/* Investment extras */}
          {type === AccountTypes.Investment && (
            <Field label="Deposited So Far">
              <input
                className={inputClassName}
                type="number"
                step="0.01"
                value={deposited}
                onChange={e => setDeposited(e.target.value)}
                placeholder="0"
              />
            </Field>
          )}

          {/* Loan extras */}
          {type === AccountTypes.Loan && (
            <>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <Field label="Principal">
                    <input
                      className={inputClassName}
                      type="number"
                      step="0.01"
                      value={principal}
                      onChange={e => setPrincipal(e.target.value)}
                      placeholder="10000"
                    />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Interest Rate %">
                    <input
                      className={inputClassName}
                      type="number"
                      step="0.01"
                      value={interestRate}
                      onChange={e => setInterestRate(e.target.value)}
                      placeholder="5.5"
                    />
                  </Field>
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <Field label="Term (months)">
                    <input
                      className={inputClassName}
                      type="number"
                      value={termMonths}
                      onChange={e => setTermMonths(e.target.value)}
                      placeholder="60"
                    />
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Start Date">
                    <input
                      className={inputClassName}
                      type="date"
                      value={loanStartDate}
                      onChange={e => setLoanStartDate(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Field label="Linked Item (optional)">
                <input
                  className={inputClassName}
                  value={linkedItemName}
                  onChange={e => setLinkedItemName(e.target.value)}
                  placeholder="iPhone 15"
                />
              </Field>
            </>
          )}

          {/* Borrowed/Lent extras */}
          {type === AccountTypes.BorrowedLent && (
            <>
              <Field label="Counterparty Name">
                <input
                  className={inputClassName}
                  value={counterpartyName}
                  onChange={e => setCounterpartyName(e.target.value)}
                  placeholder="John Doe"
                />
              </Field>
              <div className="flex gap-2.5">
                <div className="flex-1">
                  <Field label="Direction">
                    <select className={inputClassName} value={direction} onChange={e => setDirection(e.target.value)}>
                      <option value={LentDirections.Gave}>Lent (gave)</option>
                      <option value={LentDirections.Received}>Borrowed (received)</option>
                    </select>
                  </Field>
                </div>
                <div className="flex-1">
                  <Field label="Due Date (optional)">
                    <input
                      className={inputClassName}
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--fin-border)] bg-[var(--fin-card2)] py-2 text-[13px] font-semibold text-[var(--fin-muted)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className={`flex-[2] rounded-lg border-none py-2 text-[13px] font-semibold ${
                saving
                  ? 'bg-[var(--fin-card2)] text-[var(--fin-muted)]'
                  : 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
              } ${!name.trim() ? 'opacity-50' : ''}`}
            >
              {saving ? 'Saving…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
