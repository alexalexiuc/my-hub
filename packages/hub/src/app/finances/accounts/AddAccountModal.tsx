'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { AccountMutationResponse, AccountCreateData } from '@/app/api/finances/accounts/route';
import { FinModalShell } from '../FinModalShell';
import { Button, Field, Input, Select } from '@/components';
import { AccountTypes, LentDirections, ACCOUNT_TYPE_DESCRIPTIONS, SupportedCurrency } from '@my-hub/shared/constants';
import {
  AddAccountSchema,
  defaultAddAccountValues,
  formToAccountDetails,
  type AddAccountValues,
} from '../finances-form.schema';

const ACCOUNT_TYPE_OPTIONS = [
  { value: AccountTypes.Bank, label: '🏦 Bank' },
  { value: AccountTypes.Investment, label: '📈 Investment' },
  { value: AccountTypes.CreditCard, label: '💳 Credit Card' },
  { value: AccountTypes.Loan, label: '🏷 Loan' },
  { value: AccountTypes.Goal, label: '🎯 Goal' },
  { value: AccountTypes.Cash, label: '💵 Cash' },
  { value: AccountTypes.Tracking, label: '👁 Tracking' },
  { value: AccountTypes.BorrowedLent, label: '🤝 Borrowed / Lent' },
];

type AddAccountModalProps = {
  defaultCurrency: SupportedCurrency;
  onClose: () => void;
  onCreated: () => void;
};

export function AddAccountModal({ defaultCurrency, onClose, onCreated }: AddAccountModalProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<AddAccountValues>({
    resolver: zodResolver(AddAccountSchema),
    defaultValues: defaultAddAccountValues,
  });

  const type = watch('type');

  async function onSubmit(values: AddAccountValues) {
    await apiFetch<AccountMutationResponse, AccountCreateData>('/api/finances/accounts', {
      method: 'POST',
      body: {
        name: values.name,
        description: values.description.trim() || undefined,
        type: values.type,
        currency: defaultCurrency,
        openingBalance:
          values.type === AccountTypes.Loan
            ? parseFloat(values.principal) || 0
            : values.type === AccountTypes.Investment
              ? parseFloat(values.deposited) || 0
              : parseFloat(values.openingBalance) || 0,
        details: formToAccountDetails(values),
      },
    });
    onCreated();
  }

  return (
    <FinModalShell onClose={onClose} title="New Account" className="md:max-w-[420px]">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Name">
          <Input {...register('name')} placeholder="e.g. Salary" autoFocus />
        </Field>

        <Field label="Type">
          <Select {...register('type')} options={ACCOUNT_TYPE_OPTIONS} />
        </Field>

        {type && ACCOUNT_TYPE_DESCRIPTIONS[type as keyof typeof ACCOUNT_TYPE_DESCRIPTIONS] && (
          <p className="-mt-1 text-[11px] leading-[1.5] text-[var(--fin-subtle)]">
            {ACCOUNT_TYPE_DESCRIPTIONS[type as keyof typeof ACCOUNT_TYPE_DESCRIPTIONS]}
          </p>
        )}

        <Field label="Description (optional)">
          <Input {...register('description')} placeholder="e.g. Main salary account" />
        </Field>

        {type !== AccountTypes.Loan && type !== AccountTypes.Investment && (
          <Field label="Opening Balance">
            <Input {...register('openingBalance')} type="number" step="0.01" />
          </Field>
        )}

        {type === AccountTypes.CreditCard && (
          <>
            <Field label="Credit Limit">
              <Input {...register('creditLimit')} type="number" step="0.01" placeholder="5000" />
            </Field>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Statement Day">
                  <Input {...register('statementDay')} type="number" min={1} max={31} placeholder="1" />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Last 4 Digits">
                  <Input {...register('cardLastFour')} maxLength={4} placeholder="1234" />
                </Field>
              </div>
            </div>
            <Field label="Card Name (optional)">
              <Input {...register('cardName')} placeholder="Visa Platinum" />
            </Field>
          </>
        )}

        {type === AccountTypes.Bank && (
          <div className="flex gap-2.5">
            <div className="flex-1">
              <Field label="Last 4 Digits (optional)">
                <Input {...register('bankCardLastFour')} maxLength={4} placeholder="1234" />
              </Field>
            </div>
            <div className="flex-[2]">
              <Field label="Card Name (optional)">
                <Input {...register('bankCardName')} placeholder="Debit card" />
              </Field>
            </div>
          </div>
        )}

        {type === AccountTypes.Goal && (
          <Field label="Target Amount">
            <Input {...register('targetAmount')} type="number" step="0.01" placeholder="10000" />
          </Field>
        )}

        {type === AccountTypes.Investment && (
          <Field label="Deposited So Far">
            <Input {...register('deposited')} type="number" step="0.01" placeholder="0" />
          </Field>
        )}

        {type === AccountTypes.Loan && (
          <>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Principal">
                  <Input {...register('principal')} type="number" step="0.01" placeholder="10000" />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Interest Rate %">
                  <Input {...register('interestRate')} type="number" step="0.01" placeholder="5.5" />
                </Field>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Term (months)">
                  <Input {...register('termMonths')} type="number" placeholder="60" />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Start Date">
                  <Input {...register('loanStartDate')} type="date" />
                </Field>
              </div>
            </div>
            <Field label="Linked Item (optional)">
              <Input {...register('linkedItemName')} placeholder="iPhone 15" />
            </Field>
          </>
        )}

        {type === AccountTypes.BorrowedLent && (
          <>
            <Field label="Counterparty Name">
              <Input {...register('counterpartyName')} placeholder="John Doe" />
            </Field>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Direction">
                  <Select {...register('direction')}>
                    <option value={LentDirections.Gave}>Lent (gave)</option>
                    <option value={LentDirections.Received}>Borrowed (received)</option>
                  </Select>
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Due Date (optional)">
                  <Input {...register('dueDate')} type="date" />
                </Field>
              </div>
            </div>
          </>
        )}

        <div className="mt-1 flex gap-2">
          <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="flex-[2]" loading={isSubmitting}>
            Create Account
          </Button>
        </div>
      </form>
    </FinModalShell>
  );
}
