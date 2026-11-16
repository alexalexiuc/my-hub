import type { DepositAlertGroup } from '../../../finances/deposits';
import { buildFinanceReportBaseCss } from '../finance-report-shared';

export type BuildFinanceDepositAlertsHtmlData = {
  groups: DepositAlertGroup[];
  urls?: { unsubscribeUrl: string; viewInAppUrl: string };
};

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildItems(groups: DepositAlertGroup[]): string {
  return groups
    .flatMap(g =>
      g.alerts.map(alert =>
        alert.kind === 'maturity'
          ? `<div class="list-item"><span>${esc(g.accountName)}</span><span class="mono c-amber">matures ${alert.maturityDate} (in ${alert.daysToMaturity} days) — decide: renew, withdraw or move</span></div>`
          : `<div class="list-item"><span>${esc(g.accountName)}</span><span class="mono c-red">interest due ${alert.payout.date} (~${Math.round(alert.payout.net).toLocaleString('en-US')} ${esc(g.currency)} net) not recorded</span></div>`,
      ),
    )
    .join('');
}

/** Builds the HTML email listing deposit alerts (maturity approaching, missed interest payout). */
export function buildFinanceDepositAlertsHtml(data: BuildFinanceDepositAlertsHtmlData): string {
  const footer = data.urls
    ? `<div class="footer">hub.alexiuc.dev &middot; finances module<br><a href="${data.urls.unsubscribeUrl}">Unsubscribe</a> &middot; <a href="${data.urls.viewInAppUrl}">View in app</a></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Deposit alerts</title>
<style>
${buildFinanceReportBaseCss(560)}
.mono { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 12px; text-align: right; }
</style>
</head>
<body>
<div class="email-wrapper">
  <div class="header"><div><div class="header-brand">my-hub / finances</div><div class="header-title">Deposit alerts</div></div></div>
  <div class="block">${buildItems(data.groups)}</div>
  ${footer}
</div>
</body>
</html>`;
}
