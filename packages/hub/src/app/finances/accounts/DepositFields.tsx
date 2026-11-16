'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { apiFetch } from '@/lib/utils';
import type { AccountsListData } from '@/app/api/finances/accounts/route';
import { Input, SubText } from '@/components';
import { CASHFLOW_ACCOUNT_TYPES, DEFAULT_DEPOSIT_TAX_RATE, type SupportedCurrency } from '@my-hub/shared/constants';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinFieldCard } from '../ui';
import { finGhostInputClass as ghostInputClass, finDropdownInputClass as dropdownInputClass } from '../finances.utils';
import type { AddAccountValues } from '../finances-form.schema';
import { DEPOSIT_INSTRUMENT_OPTIONS, DEPOSIT_PAYOUT_OPTIONS } from './accountOptions';

type DepositFieldsProps = {
  register: UseFormRegister<AddAccountValues>;
  control: Control<AddAccountValues>;
  setValue: UseFormSetValue<AddAccountValues>;
  /** add: funding + principal + start date are asked; edit: they are fixed once the deposit is opened. */
  mode: 'add' | 'edit';
  /** Currency the deposit will be in ('' form value resolves to this). */
  defaultCurrency: SupportedCurrency;
};

/** Deposit-specific fields of the account modal (rate, term, payout, tax, linked accounts, funding). */
export function DepositFields({ register, control, setValue, mode, defaultCurrency }: DepositFieldsProps) {
  const [accounts, setAccounts] = useState<AccountsListData['accounts']>([]);
  useEffect(() => {
    apiFetch<AccountsListData>('/api/finances/accounts')
      .then(r => setAccounts(r.accounts.filter(a => !a.archived && CASHFLOW_ACCOUNT_TYPES.has(a.type))))
      .catch(() => setAccounts([]));
  }, []);

  const options = useMemo(
    () => accounts.map(a => ({ id: String(a.id), value: `${a.name} (${a.currency})` })),
    [accounts],
  );
  const [payout, sourceId, currencyValue] = useWatch({
    control,
    name: ['depPayout', 'depFundingSourceId', 'currency'],
  });
  const depositCurrency = (currencyValue || defaultCurrency) as SupportedCurrency;
  const source = accounts.find(a => String(a.id) === sourceId);
  const needsSourceAmount = mode === 'add' && source != null && source.currency !== depositCurrency;

  function accountPicker(name: 'depPayoutAccountId' | 'depReturnAccountId' | 'depFundingSourceId') {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <FinancialDropdown
            options={options}
            value={field.value}
            onChange={item => field.onChange(item?.id ?? '')}
            clearable={name !== 'depFundingSourceId'}
            placeholder="Select account"
            inputClassName={dropdownInputClass}
          />
        )}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <FinFieldCard label="Institution">
          <Input {...register('depInstitution')} placeholder="MICB" variant="ghost" className={ghostInputClass} />
        </FinFieldCard>
        <FinFieldCard label="Product (optional)">
          <Input
            {...register('depProductName')}
            placeholder="Maestro Online"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
      </div>
      <FinFieldCard label="Instrument">
        <Controller
          name="depInstrument"
          control={control}
          render={({ field }) => (
            <FinancialDropdown
              searchable={false}
              options={DEPOSIT_INSTRUMENT_OPTIONS}
              value={field.value}
              onChange={item => {
                if (!item) return;
                field.onChange(item.id);
                if (mode === 'add') {
                  setValue(
                    'depTaxRate',
                    String(DEFAULT_DEPOSIT_TAX_RATE[item.id as keyof typeof DEFAULT_DEPOSIT_TAX_RATE]),
                  );
                }
              }}
              inputClassName={dropdownInputClass}
            />
          )}
        />
      </FinFieldCard>
      <div className="grid grid-cols-2 gap-2">
        <FinFieldCard label="Principal">
          <Input
            {...register('principal')}
            type="number"
            step="0.01"
            placeholder="200000"
            disabled={mode === 'edit'}
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        <FinFieldCard label="Interest Rate %">
          <Input
            {...register('interestRate')}
            type="number"
            step="0.01"
            placeholder="8"
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
            placeholder="12"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        <FinFieldCard label="Start Date">
          <Input
            {...register('depStartDate')}
            type="date"
            disabled={mode === 'edit'}
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FinFieldCard label="Interest Paid">
          <Controller
            name="depPayout"
            control={control}
            render={({ field }) => (
              <FinancialDropdown
                searchable={false}
                options={DEPOSIT_PAYOUT_OPTIONS}
                value={field.value}
                onChange={item => item && field.onChange(item.id)}
                inputClassName={dropdownInputClass}
              />
            )}
          />
        </FinFieldCard>
        <FinFieldCard label="Tax Withheld %">
          <Input {...register('depTaxRate')} type="number" step="0.01" variant="ghost" className={ghostInputClass} />
        </FinFieldCard>
      </div>
      {payout !== 'capitalized' && (
        <FinFieldCard label="Interest Lands In">{accountPicker('depPayoutAccountId')}</FinFieldCard>
      )}
      <FinFieldCard label="Principal Returns To (optional)">{accountPicker('depReturnAccountId')}</FinFieldCard>
      <div className="grid grid-cols-2 gap-2">
        <FinFieldCard label="Tranches (optional)">
          <Input
            {...register('depTranches')}
            type="number"
            placeholder="1"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
        <FinFieldCard label="Guarantee Limit (optional)">
          <Input
            {...register('depGuaranteeLimit')}
            type="number"
            step="0.01"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>
      </div>
      <FinFieldCard label="Early Exit Rule (optional)">
        <Input
          {...register('depEarlyExitRule')}
          placeholder="e.g. lose all interest"
          variant="ghost"
          className={ghostInputClass}
        />
      </FinFieldCard>
      {mode === 'add' && (
        <>
          <FinFieldCard label="Funded From">{accountPicker('depFundingSourceId')}</FinFieldCard>
          {needsSourceAmount && (
            <FinFieldCard label={`Amount leaving ${source.name} (${source.currency})`}>
              <Input
                {...register('depFundingAmount')}
                type="number"
                step="0.01"
                variant="ghost"
                className={ghostInputClass}
              />
            </FinFieldCard>
          )}
          <SubText className="block -mt-0.5 leading-normal">
            The principal moves from the funding account to the deposit as a transfer on the start date.
          </SubText>
        </>
      )}
    </>
  );
}
