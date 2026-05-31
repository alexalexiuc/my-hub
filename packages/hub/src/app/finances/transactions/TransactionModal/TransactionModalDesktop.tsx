'use client';

import { cn } from '@/lib/utils';
import { Input, Pill } from '@/components';
import { FinancialDropdown } from '../../FinancialDropdown';
import type { FinancialDropdownCreateOption } from '../../financialDropdown.utils';
import { FinFieldCard, renderAccountOption } from '../../ui';
import { LabelMultiSelect } from '../LabelMultiSelect';
import { TransactionTypes } from '@my-hub/shared/constants';
import type { TransactionType } from '@my-hub/shared/constants';
import { getCurrencySymbol } from '@my-hub/shared/utils';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { TransactionFormDataResponse } from '@/app/api/finances/transactions/form-data/route';
import type { DropdownOption } from '../../financialDropdown.utils';
import type { UseFormRegister, UseFormWatch } from 'react-hook-form';
import type { AddTransactionValues } from '../../finances-form.schema';
import { TRANSACTION_TYPE_COLORS } from '../../finances.utils';

export type TransactionModalDesktopProps = {
  register: UseFormRegister<AddTransactionValues>;
  watch: UseFormWatch<AddTransactionValues>;
  onFormSubmit: React.FormEventHandler<HTMLFormElement>;
  isEdit: boolean;
  txType: TransactionType;
  setTxType: (t: TransactionType) => void;
  lockedType: boolean;
  typeColor: string;
  formData: TransactionFormDataResponse | null;
  amountDisplay: string;
  amountKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  amountPaste: React.ClipboardEventHandler<HTMLInputElement>;
  payeeRequired: boolean;
  payeeOptions: DropdownOption[];
  payees: PayeeWithSuggestion[];
  selPayeeId: number | null;
  selectPayee: (p: PayeeWithSuggestion) => void;
  payeeCreateOption: FinancialDropdownCreateOption;
  mostUsedPayees: PayeeWithSuggestion[];
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
  allLabels: string[];
  onLabelsChange: (vals: string[]) => void;
  dropdownInputClass: string;
};

export function TransactionModalDesktop({
  register,
  watch,
  onFormSubmit,
  isEdit,
  txType,
  setTxType,
  lockedType,
  typeColor,
  formData,
  amountDisplay,
  amountKeyDown,
  amountPaste,
  payeeRequired,
  payeeOptions,
  payees,
  selPayeeId,
  selectPayee,
  payeeCreateOption,
  mostUsedPayees,
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
  allLabels,
  onLabelsChange,
  dropdownInputClass,
}: TransactionModalDesktopProps) {
  return (
    <form data-layout="desktop" onSubmit={onFormSubmit} autoComplete="off" className="hidden flex-col gap-2.5 md:flex">
      {!lockedType && (
        <div className="flex rounded-[9px] border border-[var(--border)] bg-[var(--card2)] p-[3px]">
          {([TransactionTypes.Expense, TransactionTypes.Income, TransactionTypes.Transfer] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTxType(t)}
              className={cn(
                'flex-1 cursor-pointer rounded-[7px] border-none py-[7px] text-xs capitalize',
                txType === t ? 'font-semibold' : 'bg-transparent text-[var(--muted)]',
              )}
              style={{
                background: txType === t ? TRANSACTION_TYPE_COLORS[t] + '22' : undefined,
                color: txType === t ? TRANSACTION_TYPE_COLORS[t] : undefined,
                outline: txType === t ? `1px solid ${TRANSACTION_TYPE_COLORS[t]}44` : 'none',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-4 py-3">
        {formData && (
          <span className="text-xl font-light text-[var(--muted)]">{getCurrencySymbol(formData.currency ?? '')}</span>
        )}
        <Input
          value={amountDisplay}
          onKeyDown={amountKeyDown}
          onPaste={amountPaste}
          onChange={() => {}} // controlled by onKeyDown; e2e: use keyboard.type, not .fill
          autoFocus={!isEdit}
          type="text"
          inputMode="numeric"
          placeholder="0.00"
          variant="ghost"
          className="flex-1 text-[28px] font-bold"
          style={{ color: typeColor }}
        />
      </div>

      {!formData ? (
        <div className="flex flex-col gap-2.5">
          {[52, 80, 60, 60].map((h, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--border)] bg-[var(--card2)]"
              style={{ height: h, opacity: 0.6 }}
            />
          ))}
        </div>
      ) : (
        <>
          {payeeRequired && (
            <>
              <FinancialDropdown
                options={payeeOptions}
                value={selPayeeId ?? undefined}
                onChange={item => {
                  const full = payees.find(p => p.id === item?.id);
                  if (full) selectPayee(full);
                }}
                fuse
                placeholder="e.g. Kaufland, Netflix…"
                createOption={payeeCreateOption}
              />
              {mostUsedPayees.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {mostUsedPayees.map(p => (
                    <Pill key={p.id} onClick={() => selectPayee(p)} label={p.name} color="var(--accent)" />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <FinFieldCard className="cursor-default" label="Account">
              <FinancialDropdown
                searchable={false}
                options={accountOptions}
                value={selAccId ?? undefined}
                onChange={item => setSelAccId(item ? (item.id as number) : null)}
                renderOption={item => renderAccountOption(item, formData.accounts)}
                placeholder="Choose…"
                inputClassName={dropdownInputClass}
              />
            </FinFieldCard>

            {txType === TransactionTypes.Transfer ? (
              <FinFieldCard className="cursor-default" label="To Account">
                {prefilledToAccountId != null ? (
                  <div className="py-0.5 text-[13px] font-medium text-[var(--text)]">{prefilledToAccountName}</div>
                ) : (
                  <FinancialDropdown
                    searchable={false}
                    options={toAccountOptions}
                    value={selToAccId ?? undefined}
                    onChange={item => setSelToAccId(item ? (item.id as number) : null)}
                    renderOption={item => renderAccountOption(item, formData.accounts)}
                    placeholder="Choose…"
                    inputClassName={dropdownInputClass}
                  />
                )}
              </FinFieldCard>
            ) : (
              <FinFieldCard className="cursor-default" label="Category">
                <FinancialDropdown
                  searchable={false}
                  options={categoryOptions}
                  value={selCatId ?? undefined}
                  onChange={item => setSelCatId(item ? (item.id as number) : null)}
                  clearable={txType !== TransactionTypes.Expense}
                  noResultsText="No categories yet — add one in the Categories tab."
                  placeholder="⬡ Choose…"
                  inputClassName={dropdownInputClass}
                />
              </FinFieldCard>
            )}
          </div>

          {txType === TransactionTypes.Transfer && (
            <FinFieldCard className="cursor-default" label="Category">
              <FinancialDropdown
                searchable={false}
                options={categoryOptions}
                value={selCatId ?? undefined}
                onChange={item => setSelCatId(item ? (item.id as number) : null)}
                clearable
                noResultsText="No categories yet — add one in the Categories tab."
                placeholder="⬡ Choose…"
                inputClassName={dropdownInputClass}
              />
            </FinFieldCard>
          )}

          <div className="grid grid-cols-2 gap-2">
            <FinFieldCard className="cursor-default" label="Date">
              <Input
                {...register('date')}
                value={watch('date')}
                type="date"
                variant="ghost"
                className="w-full text-[13px] text-[var(--text)]"
              />
            </FinFieldCard>
            <FinFieldCard className="cursor-default" label="Notes">
              <Input
                {...register('note')}
                placeholder="Optional…"
                variant="ghost"
                className="w-full text-[13px] text-[var(--text)]"
              />
            </FinFieldCard>
          </div>

          <FinFieldCard className="cursor-default" label="Labels">
            <LabelMultiSelect allLabels={allLabels} value={watch('labels')} onChange={onLabelsChange} />
          </FinFieldCard>
        </>
      )}
    </form>
  );
}
