'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import type { AccountMutationResponse, AccountCreateData } from '@/app/api/finances/accounts/route';
import { FinModalShell } from '../FinModalShell';
import { Input } from '@/components';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinFieldCard, SubText } from '../ui';
import { AccountTypes, ACCOUNT_TYPE_DESCRIPTIONS, SupportedCurrency } from '@my-hub/shared/constants';
import {
  AddAccountSchema,
  defaultAddAccountValues,
  formToAccountDetails,
  type AddAccountValues,
} from '../finances-form.schema';
import { ACCOUNT_TYPE_OPTIONS, DIRECTION_OPTIONS } from './accountOptions';
import { finGhostInputClass as ghostInputClass, finDropdownInputClass as dropdownInputClass } from '../finances.utils';

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
    control,
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
    <FinModalShell
      onClose={onClose}
      title="New Account"
      className="md:max-w-[420px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Create Account"
      submitLoading={isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <FinFieldCard label="Name">
          <Input
            {...register('name')}
            placeholder="e.g. Salary"
            autoFocus
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>

        <FinFieldCard label="Type">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={ACCOUNT_TYPE_OPTIONS}
                value={field.value}
                onChange={item => field.onChange(item?.id)}
                inputClassName={dropdownInputClass}
              />
            )}
          />
        </FinFieldCard>

        {type && ACCOUNT_TYPE_DESCRIPTIONS[type as keyof typeof ACCOUNT_TYPE_DESCRIPTIONS] && (
          <SubText className="block -mt-0.5 leading-[1.5]">
            {ACCOUNT_TYPE_DESCRIPTIONS[type as keyof typeof ACCOUNT_TYPE_DESCRIPTIONS]}
          </SubText>
        )}

        <FinFieldCard label="Description (optional)">
          <Input
            {...register('description')}
            placeholder="e.g. Main salary account"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>

        {type !== AccountTypes.Loan && type !== AccountTypes.Investment && (
          <FinFieldCard label="Opening Balance">
            <Input
              {...register('openingBalance')}
              type="number"
              step="0.01"
              variant="ghost"
              className={ghostInputClass}
            />
          </FinFieldCard>
        )}

        {type === AccountTypes.CreditCard && (
          <>
            <FinFieldCard label="Credit Limit">
              <Input
                {...register('creditLimit')}
                type="number"
                step="0.01"
                placeholder="5000"
                variant="ghost"
                className={ghostInputClass}
              />
            </FinFieldCard>
            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard label="Statement Day">
                <Input
                  {...register('statementDay')}
                  type="number"
                  min={1}
                  max={31}
                  placeholder="1"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
              <FinFieldCard label="Last 4 Digits">
                <Input
                  {...register('cardLastFour')}
                  maxLength={4}
                  placeholder="1234"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
            </div>
            <FinFieldCard label="Card Name (optional)">
              <Input
                {...register('cardName')}
                placeholder="Visa Platinum"
                variant="ghost"
                className={ghostInputClass}
              />
            </FinFieldCard>
          </>
        )}

        {type === AccountTypes.Bank && (
          <div className="flex gap-2">
            <div className="flex-1">
              <FinFieldCard label="Last 4 Digits (optional)">
                <Input
                  {...register('bankCardLastFour')}
                  maxLength={4}
                  placeholder="1234"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
            </div>
            <div className="flex-[2]">
              <FinFieldCard label="Card Name (optional)">
                <Input
                  {...register('bankCardName')}
                  placeholder="Debit card"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
            </div>
          </div>
        )}

        {type === AccountTypes.Goal && (
          <FinFieldCard label="Target Amount">
            <Input
              {...register('targetAmount')}
              type="number"
              step="0.01"
              placeholder="10000"
              variant="ghost"
              className={ghostInputClass}
            />
          </FinFieldCard>
        )}

        {type === AccountTypes.Investment && (
          <FinFieldCard label="Deposited So Far">
            <Input
              {...register('deposited')}
              type="number"
              step="0.01"
              placeholder="0"
              variant="ghost"
              className={ghostInputClass}
            />
          </FinFieldCard>
        )}

        {type === AccountTypes.Loan && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard label="Principal">
                <Input
                  {...register('principal')}
                  type="number"
                  step="0.01"
                  placeholder="10000"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
              <FinFieldCard label="Interest Rate %">
                <Input
                  {...register('interestRate')}
                  type="number"
                  step="0.01"
                  placeholder="5.5"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard label="Term (months)">
                <Input
                  {...register('termMonths')}
                  type="number"
                  placeholder="60"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
              <FinFieldCard label="Start Date">
                <Input {...register('loanStartDate')} type="date" variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
            </div>
            <FinFieldCard label="Linked Item (optional)">
              <Input
                {...register('linkedItemName')}
                placeholder="iPhone 15"
                variant="ghost"
                className={ghostInputClass}
              />
            </FinFieldCard>
          </>
        )}

        {type === AccountTypes.BorrowedLent && (
          <>
            <FinFieldCard label="Counterparty Name">
              <Input
                {...register('counterpartyName')}
                placeholder="John Doe"
                variant="ghost"
                className={ghostInputClass}
              />
            </FinFieldCard>
            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard label="Direction">
                <Controller
                  name="direction"
                  control={control}
                  render={({ field }) => (
                    <FinancialDropdown
                      searchable={false}
                      options={DIRECTION_OPTIONS}
                      value={field.value}
                      onChange={item => field.onChange(item?.id)}
                      inputClassName={dropdownInputClass}
                    />
                  )}
                />
              </FinFieldCard>
              <FinFieldCard label="Due Date (optional)">
                <Input {...register('dueDate')} type="date" variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
            </div>
          </>
        )}
      </form>
    </FinModalShell>
  );
}
