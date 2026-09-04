'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { UseFormRegister, Control } from 'react-hook-form';
import { apiFetch } from '@/lib/utils';
import type { AccountMutationResponse, AccountCreateData, AccountItem } from '@/app/api/finances/accounts/route';
import { FinModalShell } from '../FinModalShell';
import { Input, SubText } from '@/components';
import { FinancialDropdown } from '../FinancialDropdown';
import { FinFieldCard } from '../ui';
import { AccountTypes, ACCOUNT_TYPE_DESCRIPTIONS, SupportedCurrency } from '@my-hub/shared/constants';
import {
  AddAccountSchema,
  EditAccountSchema,
  defaultAddAccountValues,
  formToAccountDetails,
  formToEditDetails,
  accountToEditValues,
  type AddAccountValues,
  type EditAccountValues,
} from '../finances-form.schema';
import { ACCOUNT_TYPE_OPTIONS, DIRECTION_OPTIONS } from './accountOptions';
import { finGhostInputClass as ghostInputClass, finDropdownInputClass as dropdownInputClass } from '../finances.utils';

// ─── Shared type-specific field blocks ───────────────────────────────────────

// TypeSpecificFields uses AddAccountValues as its type anchor because it is the superset of
// EditAccountValues (which omits only `openingBalance` and `type`). All fields accessed here
// exist in both schemas, so casting EditAccountValues refs to AddAccountValues is safe.
function TypeSpecificFields({
  type,
  register,
  control,
}: {
  type: string;
  register: UseFormRegister<AddAccountValues>;
  control: Control<AddAccountValues>;
}) {
  return (
    <>
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
                placeholder="1234 or 1234,5678"
                variant="ghost"
                className={ghostInputClass}
              />
            </FinFieldCard>
          </div>
          <FinFieldCard label="Card Name (optional)">
            <Input {...register('cardName')} placeholder="Visa Platinum" variant="ghost" className={ghostInputClass} />
          </FinFieldCard>
          <SubText className="block">
            If the card is also added to Apple Pay/Google Pay, add both suffixes comma-separated — phone payments can
            bill under a different last-4.
          </SubText>
        </>
      )}

      {type === AccountTypes.Bank && (
        <>
          <div className="flex gap-2">
            <div className="flex-1">
              <FinFieldCard label="Last 4 Digits (optional)">
                <Input
                  {...register('bankCardLastFour')}
                  placeholder="1234 or 1234,5678"
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
          <SubText className="block">
            If the card is also added to Apple Pay/Google Pay, add both suffixes comma-separated — phone payments can
            bill under a different last-4.
          </SubText>
        </>
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
            <FinFieldCard label="First Payment Date">
              <Input {...register('loanFirstPaymentDate')} type="date" variant="ghost" className={ghostInputClass} />
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
    </>
  );
}

// ─── Add mode ─────────────────────────────────────────────────────────────────

function AddAccountForm({
  defaultCurrency,
  onClose,
  onDone,
}: {
  defaultCurrency: SupportedCurrency;
  onClose: () => void;
  onDone: () => void;
}) {
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
    onDone();
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

        <TypeSpecificFields type={type} register={register} control={control} />
      </form>
    </FinModalShell>
  );
}

// ─── Edit mode ─────────────────────────────────────────────────────────────────

function EditAccountForm({ acc, onClose, onDone }: { acc: AccountItem; onClose: () => void; onDone: () => void }) {
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
    onDone();
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

        <TypeSpecificFields
          type={acc.type}
          register={register as unknown as UseFormRegister<AddAccountValues>}
          control={control as unknown as Control<AddAccountValues>}
        />
      </form>
    </FinModalShell>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type AccountModalProps =
  | { account?: undefined; defaultCurrency: SupportedCurrency; onClose: () => void; onDone: () => void }
  | { account: AccountItem; defaultCurrency?: never; onClose: () => void; onDone: () => void };

export function AccountModal(props: AccountModalProps) {
  if (props.account) {
    return <EditAccountForm acc={props.account} onClose={props.onClose} onDone={props.onDone} />;
  }
  return <AddAccountForm defaultCurrency={props.defaultCurrency} onClose={props.onClose} onDone={props.onDone} />;
}
