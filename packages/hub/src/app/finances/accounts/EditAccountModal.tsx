'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/utils';
import { FinModalShell } from '../FinModalShell';
import { Button, Field, Input, Select } from '@/components';
import { AccountTypes, LentDirections } from '@my-hub/shared/constants';
import {
  EditAccountSchema,
  accountToEditValues,
  formToEditDetails,
  type EditAccountValues,
} from '../finances-form.schema';
import type { AccountItem } from './types';

type EditAccountModalProps = {
  acc: AccountItem;
  onClose: () => void;
  onSaved: () => void;
};

export function EditAccountModal({ acc, onClose, onSaved }: EditAccountModalProps) {
  const {
    register,
    handleSubmit,
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
    <FinModalShell onClose={onClose} title="Edit Account" className="md:max-w-[420px]">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Field label="Name">
          <Input {...register('name')} autoFocus />
        </Field>

        <Field label="Description (optional)">
          <Input {...register('description')} placeholder="e.g. Main salary account" />
        </Field>

        {acc.type === AccountTypes.CreditCard && (
          <>
            <Field label="Credit Limit">
              <Input {...register('creditLimit')} type="number" step="0.01" />
            </Field>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Statement Day">
                  <Input {...register('statementDay')} type="number" min={1} max={31} />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Last 4 Digits">
                  <Input {...register('cardLastFour')} maxLength={4} />
                </Field>
              </div>
            </div>
            <Field label="Card Name (optional)">
              <Input {...register('cardName')} />
            </Field>
          </>
        )}

        {acc.type === AccountTypes.Bank && (
          <div className="flex gap-2.5">
            <div className="flex-1">
              <Field label="Last 4 Digits (optional)">
                <Input {...register('bankCardLastFour')} maxLength={4} />
              </Field>
            </div>
            <div className="flex-[2]">
              <Field label="Card Name (optional)">
                <Input {...register('bankCardName')} />
              </Field>
            </div>
          </div>
        )}

        {acc.type === AccountTypes.Goal && (
          <Field label="Target Amount">
            <Input {...register('targetAmount')} type="number" step="0.01" />
          </Field>
        )}

        {acc.type === AccountTypes.Investment && (
          <Field label="Deposited So Far">
            <Input {...register('deposited')} type="number" step="0.01" />
          </Field>
        )}

        {acc.type === AccountTypes.Loan && (
          <>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Principal">
                  <Input {...register('principal')} type="number" step="0.01" />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Interest Rate %">
                  <Input {...register('interestRate')} type="number" step="0.01" />
                </Field>
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="flex-1">
                <Field label="Term (months)">
                  <Input {...register('termMonths')} type="number" />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Start Date">
                  <Input {...register('loanStartDate')} type="date" />
                </Field>
              </div>
            </div>
            <Field label="Linked Item (optional)">
              <Input {...register('linkedItemName')} />
            </Field>
          </>
        )}

        {acc.type === AccountTypes.BorrowedLent && (
          <>
            <Field label="Counterparty Name">
              <Input {...register('counterpartyName')} />
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
            Save Changes
          </Button>
        </div>
      </form>
    </FinModalShell>
  );
}
