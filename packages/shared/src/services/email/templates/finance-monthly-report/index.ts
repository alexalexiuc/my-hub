import type { BuildFinanceMonthlyReportHtmlData } from './types';
import { fmtFinance as fmt, fmtFinanceSigned as fmtSigned, buildFinanceReportBaseCss } from '../finance-report-shared';

function buildCss(): string {
  return `
${buildFinanceReportBaseCss(640)}
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #2e3d50; padding: 0 0 10px 0; text-align: right; border-bottom: 1px solid #1a2230; }
.tbl th:first-child { text-align: left; }
.tbl td { padding: 9px 0; border-bottom: 1px solid #111820; font-size: 13px; color: #c8d0dc; text-align: right; }
.tbl td:first-child { text-align: left; }
.tbl td.mono { font-family: 'IBM Plex Mono','Courier New',monospace; }
.flag { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 10px; font-weight: 500; background: #2a1010; color: #e05a5a; border: 1px solid #4a1a1a; }
`.trim();
}

function buildHeader(data: BuildFinanceMonthlyReportHtmlData): string {
  return `
  <div class="header">
    <div>
      <div class="header-brand">my-hub / finances</div>
      <div class="header-title">Monthly report</div>
    </div>
    <div class="header-meta">${data.monthLabel}</div>
  </div>`;
}

function buildSummary(data: BuildFinanceMonthlyReportHtmlData): string {
  const { cashflow } = data.report;
  const netClass = cashflow.net >= 0 ? 'c-green' : 'c-red';
  return `
  <div class="section-label">Summary</div>
  <div class="stat-row">
    <div class="stat-card">
      <div class="stat-label">Income</div>
      <div class="stat-value">${fmt(cashflow.totalIncome, data.currency)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Expenses</div>
      <div class="stat-value">${fmt(cashflow.totalExpenses, data.currency)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Net cashflow</div>
      <div class="stat-value ${netClass}">${fmtSigned(cashflow.net, data.currency)}</div>
    </div>
  </div>`;
}

function buildAccountFlows(data: BuildFinanceMonthlyReportHtmlData): string {
  const rows = data.report.accountFlows.accounts
    .map(a => {
      const netClass = a.netDelta >= 0 ? 'c-green' : 'c-red';
      const flag = a.reconciles ? '' : '<span class="flag">check</span>';
      return `<tr>
      <td>${a.accountName} ${flag}</td>
      <td class="mono">${fmt(a.openingBalance, a.currency)}</td>
      <td class="mono">${fmt(a.closingBalance, a.currency)}</td>
      <td class="mono c-green">${fmt(a.inflows, a.currency)}</td>
      <td class="mono c-red">${fmt(a.outflows, a.currency)}</td>
      <td class="mono ${netClass}">${fmtSigned(a.netDelta, a.currency)}</td>
    </tr>`;
    })
    .join('');

  return `
  <div class="section-label">Account flows</div>
  <div class="block" style="overflow-x:auto;">
    <table class="tbl">
      <thead>
        <tr><th>Account</th><th>Opening</th><th>Closing</th><th>In</th><th>Out</th><th>Net</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function buildSavings(data: BuildFinanceMonthlyReportHtmlData): string {
  const s = data.report.savingsContributions;
  const delta = s.totalNetContribution - s.previousPeriod.totalNetContribution;
  const totalClass = s.totalNetContribution >= 0 ? 'c-green' : 'c-red';

  const rows = s.accounts
    .map(
      a =>
        `<div class="list-item"><span>${a.accountName}</span><span class="mono">${fmtSigned(a.netContribution, a.currency)}</span></div>`,
    )
    .join('');

  return `
  <div class="section-label">Savings &amp; investment contribution</div>
  <div class="block">
    <div class="stat-label">Net contribution this month</div>
    <div class="stat-value ${totalClass}" style="font-size:24px;margin-bottom:4px;">${fmtSigned(s.totalNetContribution, data.currency)}</div>
    <div style="font-size:11px;color:#4b5a6b;margin-bottom:14px;">${fmtSigned(delta, data.currency)} vs prior month</div>
    ${rows || '<div class="empty">No tracked savings/investment accounts.</div>'}
  </div>`;
}

function buildBudgetProgress(data: BuildFinanceMonthlyReportHtmlData): string {
  const bp = data.report.budgetProgress;
  const rows = bp.categories
    .filter(c => c.monthlyTarget != null)
    .map(c => {
      const pct = c.percentUsed ?? 0;
      const over = pct > 100;
      return `<div class="list-item"><span>${c.displayName}</span><span class="mono ${over ? 'c-red' : 'c-green'}">${fmt(c.spent, data.currency)} / ${fmt(c.monthlyTarget ?? 0, data.currency)}</span></div>`;
    })
    .join('');

  return `
  <div class="section-label">Budget vs target</div>
  <div class="block">
    <div class="list-item" style="border-bottom:1px solid #1a2230;padding-bottom:10px;margin-bottom:4px;">
      <span style="color:#4b5a6b;">Total</span>
      <span class="mono">${fmt(bp.totalSpent, data.currency)} / ${fmt(bp.totalBudgeted, data.currency)}</span>
    </div>
    ${rows || '<div class="empty">No categories with a monthly target.</div>'}
  </div>`;
}

function buildInsights(data: BuildFinanceMonthlyReportHtmlData): string {
  const { insights } = data.report;

  const spikes =
    insights.categorySpikes
      .map(s => {
        const cls = s.percentChange >= 0 ? 'c-red' : 'c-green';
        const sign = s.percentChange >= 0 ? '+' : '';
        return `<div class="list-item"><span>${s.categoryName}</span><span class="mono ${cls}">${sign}${s.percentChange}%</span></div>`;
      })
      .join('') || '<div class="empty">No categories moved significantly vs their trailing average.</div>';

  const payees =
    insights.newPayees
      .map(
        p =>
          `<div class="list-item"><span>${p.name}</span><span class="mono">${fmt(p.totalSpent, data.currency)}</span></div>`,
      )
      .join('') || '<div class="empty">No new payees this month.</div>';

  const flags =
    insights.dataQualityFlags
      .map(f => `<div class="list-item"><span>${f.accountName}</span><span class="flag">check</span></div>`)
      .join('') || '<div class="empty">No reconciliation issues detected.</div>';

  const goals =
    insights.goals
      .map(g => {
        const pctLabel = g.percentComplete != null ? `${g.percentComplete}%` : '—';
        return `<div class="list-item"><span>${g.accountName}</span><span class="mono">${fmt(g.balance, g.currency)} (${pctLabel})</span></div>`;
      })
      .join('') || '<div class="empty">No goal accounts.</div>';

  const loans =
    insights.loans
      .map(
        l =>
          `<div class="list-item"><span>${l.accountName}</span><span class="mono c-green">${fmtSigned(l.paidDownThisPeriod, l.currency)} paid down, ${fmt(l.remainingBalance, l.currency)} left</span></div>`,
      )
      .join('') || '<div class="empty">No loan accounts.</div>';

  return `
  <div class="section-label">Insights</div>
  <div class="block">
    <div style="font-size:11px;color:#4b5a6b;margin-bottom:6px;">Category spikes (vs trailing 3-month avg)</div>
    ${spikes}
  </div>
  <div class="block">
    <div style="font-size:11px;color:#4b5a6b;margin-bottom:6px;">New payees this month</div>
    ${payees}
  </div>
  <div class="block">
    <div style="font-size:11px;color:#4b5a6b;margin-bottom:6px;">Data quality</div>
    ${flags}
  </div>
  <div class="block">
    <div style="font-size:11px;color:#4b5a6b;margin-bottom:6px;">Goal progress</div>
    ${goals}
  </div>
  <div class="block">
    <div style="font-size:11px;color:#4b5a6b;margin-bottom:6px;">Loans</div>
    ${loans}
  </div>`;
}

function buildFooter(data: BuildFinanceMonthlyReportHtmlData): string {
  if (!data.urls) return '';
  return `
  <div class="footer">
    hub.alexiuc.dev &middot; finances module<br>
    ${data.monthLabel} &middot; Auto-generated<br>
    <a href="${data.urls.unsubscribeUrl}">Unsubscribe</a> &middot; <a href="${data.urls.viewInAppUrl}">View in app</a>
  </div>`;
}

export function buildFinanceMonthlyReportHtml(data: BuildFinanceMonthlyReportHtmlData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Monthly Finance Report</title>
<style>
${buildCss()}
</style>
</head>
<body>
<div class="email-wrapper">
${buildHeader(data)}
${buildSummary(data)}
${buildAccountFlows(data)}
${buildSavings(data)}
${buildBudgetProgress(data)}
${buildInsights(data)}
${data.urls ? buildFooter(data) : ''}
</div>
</body>
</html>`;
}
