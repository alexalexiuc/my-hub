/**
 * Shared formatting + CSS helpers for the finance-monthly-report and finance-yearly-report email
 * templates — split out so the two near-identical templates don't hand-maintain the same
 * currency formatting and dark-theme design tokens in two places.
 */

const FINANCE_REPORT_MINUS = '−';

export function fmtFinance(n: number, currency: string): string {
  const sign = n < 0 ? FINANCE_REPORT_MINUS : '';
  return `${sign}${Math.round(Math.abs(n)).toLocaleString('en-US')} ${currency}`;
}

export function fmtFinanceSigned(n: number, currency: string): string {
  const sign = n < 0 ? FINANCE_REPORT_MINUS : n > 0 ? '+' : '';
  return `${sign}${Math.round(Math.abs(n)).toLocaleString('en-US')} ${currency}`;
}

/**
 * Shared dark-theme CSS tokens common to both finance report emails. Excludes `.email-wrapper`
 * width and `.tbl`/`.flag` rules, which differ per template — each builds those on top of this base.
 */
export function buildFinanceReportBaseCss(wrapperMaxWidth: number): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #080b10; color: #c8d0dc; font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 14px; line-height: 1.6; padding: 32px 16px; }
.email-wrapper { max-width: ${wrapperMaxWidth}px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0 0 28px 0; border-bottom: 1px solid #1e2530; margin-bottom: 28px; }
.header-brand { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #4a7fa5; }
.header-title { font-size: 22px; font-weight: 300; color: #e4eaf2; margin-top: 6px; letter-spacing: -0.02em; }
.header-meta { text-align: right; font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 11px; color: #4b5a6b; }
.section-label { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #2e3d50; margin-bottom: 12px; }
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 28px; }
.stat-card { background: #0d1219; border: 1px solid #1a2230; border-radius: 8px; padding: 14px 16px; }
.stat-label { font-size: 11px; color: #4b5a6b; margin-bottom: 6px; }
.stat-value { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 18px; font-weight: 500; color: #e4eaf2; letter-spacing: -0.02em; }
.c-green { color: #3db87a; }
.c-red { color: #e05a5a; }
.c-amber { color: #d4924a; }
.block { background: #0d1219; border: 1px solid #1a2230; border-radius: 8px; padding: 16px 18px; margin-bottom: 28px; }
.list-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #111820; font-size: 13px; }
.list-item:last-child { border-bottom: none; }
.empty { font-size: 12px; color: #4b5a6b; padding: 4px 0; }
.footer { border-top: 1px solid #1a2230; padding-top: 20px; text-align: center; font-size: 11px; color: #2e3d50; font-family: 'IBM Plex Mono','Courier New',monospace; line-height: 1.8; margin-top: 8px; }
.footer a { color: #2e4a62; text-decoration: none; }
`.trim();
}
