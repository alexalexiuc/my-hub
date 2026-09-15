import { Card, SubText } from '@/components';
import { fmt, fmtSign } from './ui';

type CashflowSummaryCardsProps = {
  totalIncome: number;
  totalExpenses: number;
  /** Signed net for the period — rendered green when ≥ 0, red otherwise. */
  net: number;
  currency: string;
};

/** Three money figures never fit a phone at 16px — step the size down below `sm`. */
const AMOUNT_CLASS = 'mt-1 text-[12px] font-bold tabular-nums sm:text-[16px]';

/** Income / expenses / net cashflow stat-card row, shared by the Cashflow and report pages. */
export function CashflowSummaryCards({ totalIncome, totalExpenses, net, currency }: CashflowSummaryCardsProps) {
  const netColor = net >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
      <Card compact className="p-2.5 sm:p-3">
        <SubText>Income</SubText>
        <div className={AMOUNT_CLASS + ' text-[var(--text)]'}>{fmt(totalIncome, currency)}</div>
      </Card>
      <Card compact className="p-2.5 sm:p-3">
        <SubText>Expenses</SubText>
        <div className={AMOUNT_CLASS + ' text-[var(--text)]'}>{fmt(totalExpenses, currency)}</div>
      </Card>
      <Card compact className="p-2.5 sm:p-3">
        <SubText>Net cashflow</SubText>
        <div className={AMOUNT_CLASS} style={{ color: netColor }}>
          {fmtSign(net, currency)}
        </div>
      </Card>
    </div>
  );
}
