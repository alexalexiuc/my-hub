import { Card, SectionLabel, SubText } from '@/components';
import { fmt, fmtSign } from '../../ui';
import type { MonthlyReportData } from '@/app/api/finances/reports/monthly/route';

interface Props {
  report: MonthlyReportData['report'];
  currency: string;
}

function Row({ left, right, color }: { left: string; right: string; color?: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] py-2 text-[12px] last:border-none">
      <span className="text-[var(--text)]">{left}</span>
      <span className="font-medium" style={{ color: color ?? 'var(--text)' }}>
        {right}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-1 text-[12px] text-[var(--subtle)]">{text}</div>;
}

export function InsightsSection({ report, currency }: Props) {
  const { insights } = report;

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Insights</SectionLabel>

      <Card compact className="p-4">
        <SubText className="mb-2 block">Category spikes (vs trailing 3-month avg)</SubText>
        {insights.categorySpikes.length === 0 ? (
          <Empty text="No categories moved significantly." />
        ) : (
          insights.categorySpikes.map(s => (
            <Row
              key={s.categoryId ?? s.categoryName}
              left={s.categoryName}
              right={`${s.percentChange >= 0 ? '+' : ''}${s.percentChange}%`}
              color={s.percentChange >= 0 ? 'var(--red)' : 'var(--green)'}
            />
          ))
        )}
      </Card>

      <Card compact className="p-4">
        <SubText className="mb-2 block">New payees this month</SubText>
        {insights.newPayees.length === 0 ? (
          <Empty text="No new payees." />
        ) : (
          insights.newPayees.map(p => <Row key={p.payeeId} left={p.name} right={fmt(p.totalSpent, currency)} />)
        )}
      </Card>

      <Card compact className="p-4">
        <SubText className="mb-2 block">Data quality</SubText>
        {insights.dataQualityFlags.length === 0 ? (
          <Empty text="No reconciliation issues detected." />
        ) : (
          insights.dataQualityFlags.map(f => (
            <Row key={f.accountId} left={f.accountName} right="check balance" color="var(--red)" />
          ))
        )}
      </Card>

      <Card compact className="p-4">
        <SubText className="mb-2 block">Goal progress</SubText>
        {insights.goals.length === 0 ? (
          <Empty text="No goal accounts." />
        ) : (
          insights.goals.map(g => (
            <Row
              key={g.accountId}
              left={g.accountName}
              right={`${fmt(g.balance, g.currency)}${g.percentComplete != null ? ` (${g.percentComplete}%)` : ''}`}
            />
          ))
        )}
      </Card>

      <Card compact className="p-4">
        <SubText className="mb-2 block">Loans</SubText>
        {insights.loans.length === 0 ? (
          <Empty text="No loan accounts." />
        ) : (
          insights.loans.map(l => (
            <Row
              key={l.accountId}
              left={l.accountName}
              right={`${fmtSign(l.paidDownThisPeriod, l.currency)} paid down, ${fmt(l.remainingBalance, l.currency)} left`}
              color="var(--green)"
            />
          ))
        )}
      </Card>
    </div>
  );
}
