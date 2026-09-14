import { Card, SubText } from '@/components';
import { fmt, fmtSign } from '../ui';
import type { CashflowSummaryResult } from '@my-hub/shared/services';

interface Props {
  cashflow: CashflowSummaryResult;
  currency: string;
}

/** Income / expenses / net cashflow stat-card row, shared by the monthly and yearly report pages. */
export function CashflowSummaryCards({ cashflow, currency }: Props) {
  const netColor = cashflow.net >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card compact className="p-3">
        <SubText>Income</SubText>
        <div className="mt-1 text-[16px] font-bold text-[var(--text)]">{fmt(cashflow.totalIncome, currency)}</div>
      </Card>
      <Card compact className="p-3">
        <SubText>Expenses</SubText>
        <div className="mt-1 text-[16px] font-bold text-[var(--text)]">{fmt(cashflow.totalExpenses, currency)}</div>
      </Card>
      <Card compact className="p-3">
        <SubText>Net cashflow</SubText>
        <div className="mt-1 text-[16px] font-bold" style={{ color: netColor }}>
          {fmtSign(cashflow.net, currency)}
        </div>
      </Card>
    </div>
  );
}
