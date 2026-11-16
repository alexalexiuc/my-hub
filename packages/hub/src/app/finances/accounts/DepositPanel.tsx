'use client';

import { useState } from 'react';
import { formatMoney } from '@my-hub/shared/utils';
import { Button, Card, Pill, ProgressBar, SubText } from '@/components';
import type { AccountItem } from '@/app/api/finances/accounts/route';
import { transactionEvents } from '../transactions/transactionEvents';
import { DepositCloseModal } from './DepositCloseModal';
import { DepositInterestModal } from './DepositInterestModal';

type DepositPanelProps = {
  acc: AccountItem;
  /** Reload the account after a change. */
  onChanged: () => void;
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <SubText className="block">{label}</SubText>
      <div className={tone ?? 'text-[var(--text)]'}>{value}</div>
    </div>
  );
}

/** Deposit detail block: term progress, expected vs received interest, next payout and lifecycle actions. */
export function DepositPanel({ acc, onChanged }: DepositPanelProps) {
  const [interestOpen, setInterestOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const s = acc.depositSummary;
  if (!s) return null;

  const closed = s.status !== 'active';
  const done = () => {
    setInterestOpen(false);
    setCloseOpen(false);
    transactionEvents.emit('changed');
    onChanged();
  };

  return (
    <div data-testid="deposit-panel">
      <Card className="flex flex-col gap-3 p-[14px]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-[var(--text)]">
            {acc.institution}
            {acc.productName ? ` · ${acc.productName}` : ''}
          </div>
          {closed ? (
            <Pill label={s.status === 'matured' ? 'Matured' : 'Broken early'} color="var(--muted)" />
          ) : (
            <Pill label={`${s.daysToMaturity} days left`} color="var(--teal)" />
          )}
        </div>

        <div>
          <ProgressBar value={s.progressPercent} max={100} color="var(--teal)" height={6} thresholds={false} />
          <div className="mt-1.5 flex justify-between text-[11px] text-[var(--muted)]">
            <span>{acc.startDate}</span>
            <span>Matures {s.maturityDate}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 text-[13px] md:grid-cols-3">
          <Stat label="Rate" value={`${acc.interestRate ?? 0}%${s.rateEstimated ? ' (est.)' : ''}`} />
          <Stat label="Net yield" value={`${s.effectiveNetYield}%`} />
          <Stat label="Tax withheld" value={`${acc.taxRate ?? 0}%`} />
          <Stat
            label="Interest received"
            value={formatMoney(s.interestReceivedToDate, acc.currency)}
            tone="text-[var(--green)]"
          />
          <Stat
            label="Interest remaining"
            value={formatMoney(s.interestRemaining, acc.currency)}
            tone="text-[var(--amber)]"
          />
          <Stat label="Expected net total" value={formatMoney(s.expectedNetInterest, acc.currency)} />
          {!closed && s.nextPayoutDate && s.nextPayoutAmount != null && (
            <Stat
              label="Next payout"
              value={`${formatMoney(s.nextPayoutAmount, acc.currency)} · ${s.nextPayoutDate}`}
            />
          )}
          {acc.tranches != null && acc.tranches > 1 && <Stat label="Tranches" value={String(acc.tranches)} />}
        </div>

        {s.overGuarantee && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-400">
            ⚠ Principal plus capitalized interest exceeds the guarantee limit of{' '}
            {formatMoney(acc.guaranteeLimit ?? 0, acc.currency)}.
          </div>
        )}

        {!closed && (
          <div className="flex gap-2">
            <Button onClick={() => setInterestOpen(true)}>Log interest</Button>
            <Button variant="secondary" onClick={() => setCloseOpen(true)}>
              Close deposit
            </Button>
          </div>
        )}

        {interestOpen && (
          <DepositInterestModal
            accountId={acc.id}
            currency={acc.currency}
            suggestedNet={s.nextPayoutAmount}
            onClose={() => setInterestOpen(false)}
            onDone={done}
          />
        )}
        {closeOpen && (
          <DepositCloseModal
            accountId={acc.id}
            name={acc.name}
            currency={acc.currency}
            onClose={() => setCloseOpen(false)}
            onDone={done}
          />
        )}
      </Card>
    </div>
  );
}
