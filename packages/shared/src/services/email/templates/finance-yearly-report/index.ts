import type { BuildFinanceYearlyReportHtmlData } from './types';
import { fmtFinance as fmt, fmtFinanceSigned as fmtSigned, buildFinanceReportBaseCss } from '../finance-report-shared';

const TOP_CATEGORIES = 8;

function buildCss(): string {
  return `
${buildFinanceReportBaseCss(680)}
.tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.tbl th { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: #2e3d50; padding: 0 6px 10px 0; text-align: right; border-bottom: 1px solid #1a2230; white-space: nowrap; }
.tbl th:first-child { text-align: left; }
.tbl td { padding: 7px 6px 7px 0; border-bottom: 1px solid #111820; color: #c8d0dc; text-align: right; font-family: 'IBM Plex Mono','Courier New',monospace; white-space: nowrap; }
.tbl td:first-child { text-align: left; font-family: 'IBM Plex Sans', sans-serif; }
`.trim();
}

function buildHeader(data: BuildFinanceYearlyReportHtmlData): string {
  return `
  <div class="header">
    <div>
      <div class="header-brand">my-hub / finances</div>
      <div class="header-title">Yearly report</div>
    </div>
    <div class="header-meta">${data.report.year}</div>
  </div>`;
}

function buildSummary(data: BuildFinanceYearlyReportHtmlData): string {
  const { cashflow } = data.report;
  const netClass = cashflow.net >= 0 ? 'c-green' : 'c-red';
  return `
  <div class="section-label">Summary</div>
  <div class="stat-row">
    <div class="stat-card"><div class="stat-label">Income</div><div class="stat-value">${fmt(cashflow.totalIncome, data.currency)}</div></div>
    <div class="stat-card"><div class="stat-label">Expenses</div><div class="stat-value">${fmt(cashflow.totalExpenses, data.currency)}</div></div>
    <div class="stat-card"><div class="stat-label">Net cashflow</div><div class="stat-value ${netClass}">${fmtSigned(cashflow.net, data.currency)}</div></div>
  </div>`;
}

function buildNetWorth(data: BuildFinanceYearlyReportHtmlData): string {
  const { netWorthHistory, netWorthDelta } = data.report;
  if (netWorthHistory.length === 0) {
    return `
  <div class="section-label">Net worth trajectory</div>
  <div class="block"><div class="empty">No monthly net worth snapshots recorded for this year yet.</div></div>`;
  }

  const rows = netWorthHistory
    .map(
      h =>
        `<div class="list-item"><span>${h.month}</span><span class="mono">${fmt(h.netWorth, data.currency)}</span></div>`,
    )
    .join('');
  const deltaClass = (netWorthDelta ?? 0) >= 0 ? 'c-green' : 'c-red';

  return `
  <div class="section-label">Net worth trajectory</div>
  <div class="block">
    ${netWorthDelta != null ? `<div class="stat-label">Start-of-year to end-of-year</div><div class="stat-value ${deltaClass}" style="font-size:22px;margin-bottom:14px;">${fmtSigned(netWorthDelta, data.currency)}</div>` : ''}
    ${rows}
  </div>`;
}

function buildSavingsAndIbkr(data: BuildFinanceYearlyReportHtmlData): string {
  const s = data.report.savingsContributions;
  const totalClass = s.totalNetContribution >= 0 ? 'c-green' : 'c-red';
  const accountRows = s.accounts
    .map(
      a =>
        `<div class="list-item"><span>${a.accountName}</span><span class="mono">${fmtSigned(a.netContribution, a.currency)}</span></div>`,
    )
    .join('');

  const ibkr = data.report.ibkrDca;
  const ibkrBlock = ibkr
    ? `<div class="stat-label" style="margin-top:14px;">Portfolio DCA vs target</div>
       <div class="stat-value" style="font-size:16px;">${fmt(ibkr.actualContributed, ibkr.currency)} / ${fmt(ibkr.targetContribution, ibkr.currency)}</div>`
    : '';

  return `
  <div class="section-label">Savings &amp; investment contribution</div>
  <div class="block">
    <div class="stat-label">Net contribution this year</div>
    <div class="stat-value ${totalClass}" style="font-size:24px;margin-bottom:14px;">${fmtSigned(s.totalNetContribution, data.currency)}</div>
    ${accountRows || '<div class="empty">No tracked savings/investment accounts.</div>'}
    ${ibkrBlock}
  </div>`;
}

function buildLoans(data: BuildFinanceYearlyReportHtmlData): string {
  const rows = data.report.loans
    .map(
      l =>
        `<div class="list-item"><span>${l.accountName}</span><span class="mono c-green">${fmtSigned(l.paidDownThisYear, l.currency)} paid down, ${fmt(l.remainingBalance, l.currency)} left</span></div>`,
    )
    .join('');

  return `
  <div class="section-label">Loan payoff progress</div>
  <div class="block">${rows || '<div class="empty">No loan accounts.</div>'}</div>`;
}

function buildCategoryByMonth(data: BuildFinanceYearlyReportHtmlData): string {
  const rows = data.report.categoryByMonth
    .map(c => ({ ...c, total: Object.values(c.months).reduce((s, v) => s + v, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_CATEGORIES);

  if (rows.length === 0) {
    return `
  <div class="section-label">Category spend by month</div>
  <div class="block"><div class="empty">No categorized expenses this year.</div></div>`;
  }

  const months = Array.from({ length: 12 }, (_, i) => `${data.report.year}-${String(i + 1).padStart(2, '0')}`);
  const monthHeaders = months.map(m => `<th>${m.slice(5)}</th>`).join('');
  const bodyRows = rows
    .map(r => {
      const cells = months.map(m => `<td>${Math.round(r.months[m] ?? 0).toLocaleString('en-US')}</td>`).join('');
      return `<tr><td>${r.categoryName}</td>${cells}</tr>`;
    })
    .join('');

  return `
  <div class="section-label">Category spend by month (top ${rows.length})</div>
  <div class="block" style="overflow-x:auto;">
    <table class="tbl">
      <thead><tr><th>Category</th>${monthHeaders}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>`;
}

function buildYoY(data: BuildFinanceYearlyReportHtmlData): string {
  const rows = data.report.yearOverYear.groups
    .filter(g => g.absoluteDelta !== 0)
    .slice(0, 10)
    .map(g => {
      const cls = g.absoluteDelta >= 0 ? 'c-red' : 'c-green';
      const pct = g.percentDelta != null ? ` (${g.percentDelta >= 0 ? '+' : ''}${g.percentDelta}%)` : '';
      return `<div class="list-item"><span>${g.key}</span><span class="mono ${cls}">${fmtSigned(g.absoluteDelta, data.currency)}${pct}</span></div>`;
    })
    .join('');

  return `
  <div class="section-label">Year-over-year (biggest movers)</div>
  <div class="block">${rows || '<div class="empty">Not enough history for a year-over-year comparison yet.</div>'}</div>`;
}

function buildFooter(data: BuildFinanceYearlyReportHtmlData): string {
  if (!data.urls) return '';
  return `
  <div class="footer">
    hub.alexiuc.dev &middot; finances module<br>
    ${data.report.year} &middot; Auto-generated<br>
    <a href="${data.urls.unsubscribeUrl}">Unsubscribe</a> &middot; <a href="${data.urls.viewInAppUrl}">View in app</a>
  </div>`;
}

export function buildFinanceYearlyReportHtml(data: BuildFinanceYearlyReportHtmlData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Yearly Finance Report</title>
<style>
${buildCss()}
</style>
</head>
<body>
<div class="email-wrapper">
${buildHeader(data)}
${buildSummary(data)}
${buildNetWorth(data)}
${buildSavingsAndIbkr(data)}
${buildLoans(data)}
${buildCategoryByMonth(data)}
${buildYoY(data)}
${data.urls ? buildFooter(data) : ''}
</div>
</body>
</html>`;
}
