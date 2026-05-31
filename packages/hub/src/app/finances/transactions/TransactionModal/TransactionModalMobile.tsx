'use client';

import { cn } from '@/lib/utils';
import { Button, Input, Pill } from '@/components';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { FinancialDropdownCreateOption } from '../../financialDropdown.utils';
import { LabelMultiSelect } from '../LabelMultiSelect';
import { renderAccountOption } from '../../ui';
import { TransactionTypes } from '@my-hub/shared/constants';
import type { TransactionType } from '@my-hub/shared/constants';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import type { DropdownOption } from '../../financialDropdown.utils';
import type { UseFormRegister } from 'react-hook-form';
import type { AddTransactionValues } from '../../finances-form.schema';
import { MOBILE_TYPE_LABELS } from './transactionModal.utils';
import { TRANSACTION_TYPE_COLORS } from '../../finances.utils';

function MobileFieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
      <div className="w-20 shrink-0 text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">{label}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export type TransactionModalMobileProps = {
  txType: TransactionType;
  setTxType: (t: TransactionType) => void;
  lockedType: boolean;
  typeColor: string;
  amountDisplay: string;
  mobileAmountText: string;
  largeExpression: string | null;
  keypadOpen: boolean;
  openKeypad: () => void;
  closeKeypadAndCommit: () => void;
  payeeRequired: boolean;
  payeeOptions: DropdownOption[];
  payees: PayeeWithSuggestion[];
  selPayeeId: number | null;
  selectPayee: (p: PayeeWithSuggestion) => void;
  payeeCreateOption: FinancialDropdownCreateOption;
  mostUsedPayees: PayeeWithSuggestion[];
  allAccounts: TransactionFormDataResponse['accounts'];
  accountOptions: DropdownOption[];
  selAccId: number | null;
  setSelAccId: (id: number | null) => void;
  toAccountOptions: DropdownOption[];
  selToAccId: number | null;
  setSelToAccId: (id: number | null) => void;
  categoryOptions: DropdownOption[];
  selCatId: number | null;
  setSelCatId: (id: number | null) => void;
  prefilledToAccountId?: number;
  prefilledToAccountName?: string;
  date: string;
  setDate: (d: string) => void;
  register: UseFormRegister<AddTransactionValues>;
  allLabels: string[];
  labels: string[];
  onLabelsChange: (vals: string[]) => void;
  dropdownInputClass: string;
};

export function TransactionModalMobile({
  txType,
  setTxType,
  lockedType,
  typeColor,
  amountDisplay,
  mobileAmountText,
  largeExpression,
  keypadOpen,
  openKeypad,
  closeKeypadAndCommit,
  payeeRequired,
  payeeOptions,
  payees,
  selPayeeId,
  selectPayee,
  payeeCreateOption,
  mostUsedPayees,
  allAccounts,
  accountOptions,
  selAccId,
  setSelAccId,
  toAccountOptions,
  selToAccId,
  setSelToAccId,
  categoryOptions,
  selCatId,
  setSelCatId,
  prefilledToAccountId,
  prefilledToAccountName,
  date,
  setDate,
  register,
  allLabels,
  labels,
  onLabelsChange,
  dropdownInputClass,
}: TransactionModalMobileProps) {
  return (
    <div data-layout="mobile" className="flex flex-1 flex-col md:hidden">
      {!lockedType && (
        <div className="flex shrink-0 gap-1.5 px-4 pb-1 pt-3">
          {([TransactionTypes.Expense, TransactionTypes.Income, TransactionTypes.Transfer] as const).map(t => (
            <Button
              key={t}
              type="button"
              variant="transparent"
              size="xs"
              onClick={() => setTxType(t)}
              className={cn(
                'flex-1 cursor-pointer rounded-[8px] py-2 text-xs font-medium',
                txType === t ? 'font-semibold' : 'text-[var(--muted)]',
              )}
              style={{
                background: txType === t ? TRANSACTION_TYPE_COLORS[t] + '22' : 'var(--card2)',
                color: txType === t ? TRANSACTION_TYPE_COLORS[t] : undefined,
                outline: txType === t ? `1px solid ${TRANSACTION_TYPE_COLORS[t]}44` : 'none',
              }}
            >
              {MOBILE_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      <div onClick={openKeypad} className="flex shrink-0 cursor-pointer flex-col items-center py-5 active:opacity-70">
        {largeExpression ? (
          <p className="px-5 text-center text-2xl font-bold leading-snug" style={{ color: typeColor }}>
            {largeExpression}
          </p>
        ) : (
          <span className="text-5xl font-bold tracking-tight" style={{ color: typeColor }}>
            {mobileAmountText}
          </span>
        )}
        {!amountDisplay && !largeExpression && !keypadOpen ? (
          <span className="mt-1.5 text-xs text-[var(--muted)]">Tap to Enter Amount</span>
        ) : null}
      </div>

      <div
        className="flex-1 divide-y divide-[var(--border)] overflow-y-auto border-t border-[var(--border)]"
        onClickCapture={closeKeypadAndCommit}
      >
        {payeeRequired && (
          <>
            <MobileFieldRow label="Payee">
              <FinancialDropdown
                options={payeeOptions}
                value={selPayeeId ?? undefined}
                onChange={item => {
                  const full = payees.find(p => p.id === item?.id);
                  if (full) selectPayee(full);
                }}
                fuse
                placeholder="Select or add payee..."
                createOption={payeeCreateOption}
                inputClassName={dropdownInputClass}
              />
            </MobileFieldRow>
            {mostUsedPayees.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-2.5">
                {mostUsedPayees.map(p => (
                  <Pill key={p.id} onClick={() => selectPayee(p)} label={p.name} color="var(--accent)" />
                ))}
              </div>
            )}
          </>
        )}

        <MobileFieldRow label="Account">
          <FinancialDropdown
            searchable={false}
            options={accountOptions}
            value={selAccId ?? undefined}
            onChange={item => setSelAccId(item ? (item.id as number) : null)}
            renderOption={item => renderAccountOption(item, allAccounts)}
            placeholder="Choose..."
            inputClassName={dropdownInputClass}
          />
        </MobileFieldRow>

        {txType === TransactionTypes.Transfer ? (
          <>
            <MobileFieldRow label="To Account">
              {prefilledToAccountId != null ? (
                <span className="text-[13px] font-medium text-[var(--text)]">{prefilledToAccountName}</span>
              ) : (
                <FinancialDropdown
                  searchable={false}
                  options={toAccountOptions}
                  value={selToAccId ?? undefined}
                  onChange={item => setSelToAccId(item ? (item.id as number) : null)}
                  renderOption={item => renderAccountOption(item, allAccounts)}
                  placeholder="Choose..."
                  inputClassName={dropdownInputClass}
                />
              )}
            </MobileFieldRow>
            <MobileFieldRow label="Category">
              <FinancialDropdown
                searchable={false}
                options={categoryOptions}
                value={selCatId ?? undefined}
                onChange={item => setSelCatId(item ? (item.id as number) : null)}
                clearable
                noResultsText="No categories yet — add one in the Categories tab."
                placeholder="⬡ Choose..."
                inputClassName={dropdownInputClass}
              />
            </MobileFieldRow>
          </>
        ) : (
          <MobileFieldRow label="Category">
            <FinancialDropdown
              searchable={false}
              options={categoryOptions}
              value={selCatId ?? undefined}
              onChange={item => setSelCatId(item ? (item.id as number) : null)}
              clearable={txType !== TransactionTypes.Expense}
              noResultsText="No categories yet — add one in the Categories tab."
              placeholder={
                selPayeeId == null && txType === TransactionTypes.Expense ? 'Select payee first' : '⬡ Choose...'
              }
              inputClassName={dropdownInputClass}
            />
          </MobileFieldRow>
        )}

        <MobileFieldRow label="Date">
          <Input
            name="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            type="date"
            variant="ghost"
            className="flex-1 text-[13px] text-[var(--text)]"
          />
        </MobileFieldRow>

        <MobileFieldRow label="Memo">
          <Input
            {...register('note')}
            placeholder="Add a note..."
            variant="ghost"
            className="flex-1 text-[13px] text-[var(--text)]"
          />
        </MobileFieldRow>

        <MobileFieldRow label="Labels">
          <LabelMultiSelect
            allLabels={allLabels}
            value={labels}
            onChange={onLabelsChange}
            inputClassName={dropdownInputClass}
          />
        </MobileFieldRow>
      </div>
    </div>
  );
}
