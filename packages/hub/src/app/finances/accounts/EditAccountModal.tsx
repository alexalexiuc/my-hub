'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Input } from '@/components';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinFieldCard } from '../ui';
import { AccountTypes } from '@my-hub/shared/constants';
import { DIRECTION_OPTIONS } from './accountOptions';
import {
  EditAccountSchema,
  accountToEditValues,
  formToEditDetails,
  type EditAccountValues,
} from '../finances-form.schema';
import type { AccountItem } from '@/app/api/finances/accounts/route';
import { finGhostInputClass as ghostInputClass, finDropdownInputClass as dropdownInputClass } from '../finances.utils';

type EditAccountModalProps = {
  acc: AccountItem;
  onClose: () => void;
  onSaved: () => void;
};

export function EditAccountModal({ acc, onClose, onSaved }: EditAccountModalProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<EditAccountValues>({
    resolver: zodResolver(EditAccountSchema),
    defaultValues: accountToEditValues(acc),
  });

  async function onSubmit(values: EditAccountValues) {
    const details = formToEditDetails(acc.type, values, { settled: acc.settled });
    await apiFetch(`/api/finances/accounts/${acc.id}`, {
      method: 'PATCH',
      body: {
        action: 'edit',
        name: values.name,
        description: values.description.trim() || null,
        ...(details !== null ? { details } : {}),
      },
    });
    onSaved();
  }

  return (
    <FinModalShell
      onClose={onClose}
      title="Edit Account"
      className="md:max-w-[420px]"
      onSubmit={handleSubmit(onSubmit)}
      submitLabel="Save Changes"
      submitLoading={isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <FinFieldCard label="Name">
          <Input {...register('name')} autoFocus variant="ghost" className={ghostInputClass} />
        </FinFieldCard>

        <FinFieldCard label="Description (optional)">
          <Input
            {...register('description')}
            placeholder="e.g. Main salary account"
            variant="ghost"
            className={ghostInputClass}
          />
        </FinFieldCard>

        {acc.type === AccountTypes.CreditCard && (
          <>
            <FinFieldCard label="Credit Limit">
              <Input
                {...register('creditLimit')}
                type="number"
                step="0.01"
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
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
              <FinFieldCard label="Last 4 Digits">
                <Input {...register('cardLastFour')} maxLength={4} variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
            </div>
            <FinFieldCard label="Card Name (optional)">
              <Input {...register('cardName')} variant="ghost" className={ghostInputClass} />
            </FinFieldCard>
          </>
        )}

        {acc.type === AccountTypes.Bank && (
          <div className="flex gap-2">
            <div className="flex-1">
              <FinFieldCard label="Last 4 Digits (optional)">
                <Input {...register('bankCardLastFour')} maxLength={4} variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
            </div>
            <div className="flex-[2]">
              <FinFieldCard label="Card Name (optional)">
                <Input {...register('bankCardName')} variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
            </div>
          </div>
        )}

        {acc.type === AccountTypes.Goal && (
          <FinFieldCard label="Target Amount">
            <Input
              {...register('targetAmount')}
              type="number"
              step="0.01"
              variant="ghost"
              className={ghostInputClass}
            />
          </FinFieldCard>
        )}

        {acc.type === AccountTypes.Investment && (
          <FinFieldCard label="Deposited So Far">
            <Input {...register('deposited')} type="number" step="0.01" variant="ghost" className={ghostInputClass} />
          </FinFieldCard>
        )}

        {acc.type === AccountTypes.Loan && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard label="Principal">
                <Input
                  {...register('principal')}
                  type="number"
                  step="0.01"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
              <FinFieldCard label="Interest Rate %">
                <Input
                  {...register('interestRate')}
                  type="number"
                  step="0.01"
                  variant="ghost"
                  className={ghostInputClass}
                />
              </FinFieldCard>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FinFieldCard label="Term (months)">
                <Input {...register('termMonths')} type="number" variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
              <FinFieldCard label="Start Date">
                <Input {...register('loanStartDate')} type="date" variant="ghost" className={ghostInputClass} />
              </FinFieldCard>
            </div>
            <FinFieldCard label="Linked Item (optional)">
              <Input {...register('linkedItemName')} variant="ghost" className={ghostInputClass} />
            </FinFieldCard>
          </>
        )}

        {acc.type === AccountTypes.BorrowedLent && (
          <>
            <FinFieldCard label="Counterparty Name">
              <Input {...register('counterpartyName')} variant="ghost" className={ghostInputClass} />
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
