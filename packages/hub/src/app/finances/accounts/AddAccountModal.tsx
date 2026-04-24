'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/utils';
import { T } from '../ui';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: T.subtle, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: T.card2,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '7px 10px',
  fontSize: 13,
  color: T.text,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

export function AddAccountModal({ defaultCurrency, onClose, onCreated }: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(AccountTypes.Bank);
  const [currency, setCurrency] = useState(defaultCurrency);
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.65)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 20,
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>New Account</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Name">
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Revolut"
              autoFocus
              required
            />
          </Field>

          <Field label="Type">
            <select style={inputStyle} value={type} onChange={e => setType(e.target.value)}>
              {ACCOUNT_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="Currency">
                <input
                  style={inputStyle}
                  value={currency}
                  onChange={e => setCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  placeholder="EUR"
                />
              </Field>
            </div>
            <div style={{ flex: 2 }}>
              <Field label="Opening Balance">
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* Credit Card extras */}
          {type === AccountTypes.CreditCard && (
            <>
              <Field label="Credit Limit">
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                  placeholder="5000"
                />
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Statement Day">
                    <input
                      style={inputStyle}
                      type="number"
                      min={1}
                      max={31}
                      value={statementDay}
                      onChange={e => setStatementDay(e.target.value)}
                      placeholder="1"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Last 4 Digits">
                    <input
                      style={inputStyle}
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
                  style={inputStyle}
                  value={cardName}
                  onChange={e => setCardName(e.target.value)}
                  placeholder="Visa Platinum"
                />
              </Field>
            </>
          )}

          {/* Bank extras */}
          {type === AccountTypes.Bank && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="Last 4 Digits (optional)">
                  <input
                    style={inputStyle}
                    maxLength={4}
                    value={bankCardLastFour}
                    onChange={e => setBankCardLastFour(e.target.value)}
                    placeholder="1234"
                  />
                </Field>
              </div>
              <div style={{ flex: 2 }}>
                <Field label="Card Name (optional)">
                  <input
                    style={inputStyle}
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
                style={inputStyle}
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
                style={inputStyle}
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
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Principal">
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      value={principal}
                      onChange={e => setPrincipal(e.target.value)}
                      placeholder="10000"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Interest Rate %">
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      value={interestRate}
                      onChange={e => setInterestRate(e.target.value)}
                      placeholder="5.5"
                    />
                  </Field>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Term (months)">
                    <input
                      style={inputStyle}
                      type="number"
                      value={termMonths}
                      onChange={e => setTermMonths(e.target.value)}
                      placeholder="60"
                    />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Start Date">
                    <input
                      style={inputStyle}
                      type="date"
                      value={loanStartDate}
                      onChange={e => setLoanStartDate(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Field label="Linked Item (optional)">
                <input
                  style={inputStyle}
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
                  style={inputStyle}
                  value={counterpartyName}
                  onChange={e => setCounterpartyName(e.target.value)}
                  placeholder="John Doe"
                />
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Direction">
                    <select style={inputStyle} value={direction} onChange={e => setDirection(e.target.value)}>
                      <option value={LentDirections.Gave}>Lent (gave)</option>
                      <option value={LentDirections.Received}>Borrowed (received)</option>
                    </select>
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Due Date (optional)">
                    <input style={inputStyle} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </Field>
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: T.card2,
                border: `1px solid ${T.border}`,
                color: T.muted,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              style={{
                flex: 2,
                padding: '8px 0',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: saving ? T.card2 : T.accent,
                border: 'none',
                color: saving ? T.muted : '#0e0e12',
                cursor: saving ? 'default' : 'pointer',
                opacity: !name.trim() ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
