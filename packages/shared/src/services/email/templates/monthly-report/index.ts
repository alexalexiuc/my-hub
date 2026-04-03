import type { MonthlyReportData } from './types';

const MINUS = '\u2212';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtWeight(n: number): string {
  return n.toFixed(1);
}

function barColor(delta: number): string {
  if (delta <= 0) return '#1d4e3a';
  if (delta <= 200) return '#2a3a1d';
  return '#3a1d1d';
}

function deltaClass(delta: number): string {
  if (delta <= 0) return 'c-green';
  if (delta <= 200) return 'c-amber';
  return 'c-red';
}

function buildCss(): string {
  return `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: #080b10;
  color: #c8d0dc;
  font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  padding: 32px 16px;
}
.email-wrapper { max-width: 620px; margin: 0 auto; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0 0 28px 0;
  border-bottom: 1px solid #1e2530;
  margin-bottom: 28px;
}
.header-brand { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 11px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #4a7fa5; }
.header-title { font-size: 22px; font-weight: 300; color: #e4eaf2; margin-top: 6px; letter-spacing: -0.02em; }
.header-meta { text-align: right; font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 11px; color: #4b5a6b; }
.header-verdict { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; letter-spacing: 0.05em; }
.verdict-on-track { background: #0e2a1f; color: #3db87a; border: 1px solid #1a4a33; }
.verdict-over { background: #2a1010; color: #e05a5a; border: 1px solid #4a1a1a; }

.section-label { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: #2e3d50; margin-bottom: 12px; }

.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 28px; }
.stat-card { background: #0d1219; border: 1px solid #1a2230; border-radius: 8px; padding: 14px 16px; }
.stat-label { font-size: 11px; color: #4b5a6b; margin-bottom: 6px; }
.stat-value { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 20px; font-weight: 500; color: #e4eaf2; letter-spacing: -0.02em; }
.stat-unit { font-size: 12px; color: #4b5a6b; margin-left: 2px; }
.stat-sub { font-size: 11px; color: #4b5a6b; margin-top: 4px; }
.c-green { color: #3db87a; }
.c-red { color: #e05a5a; }
.c-amber { color: #d4924a; }

.chart-block { background: #0d1219; border: 1px solid #1a2230; border-radius: 8px; padding: 20px; margin-bottom: 28px; }
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.bar-day { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 11px; color: #4b5a6b; width: 54px; flex-shrink: 0; }
.bar-track { flex: 1; height: 22px; background: #111820; border-radius: 3px; position: relative; overflow: visible; }
.bar-fill { height: 100%; border-radius: 3px; position: relative; }
.bar-goal-line { position: absolute; top: -4px; bottom: -4px; width: 1px; background: #2e4a62; }
.bar-kcal { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 11px; color: #4b5a6b; width: 48px; text-align: right; flex-shrink: 0; }
.bar-delta { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 10px; width: 44px; text-align: right; flex-shrink: 0; }

.macro-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 28px; }
.macro-card { background: #0d1219; border: 1px solid #1a2230; border-radius: 8px; padding: 14px 16px; }
.macro-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; vertical-align: middle; }
.macro-name { font-size: 12px; color: #6b7d90; margin-bottom: 8px; }
.macro-g { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 20px; font-weight: 500; color: #e4eaf2; }
.macro-pct { font-size: 12px; color: #4b5a6b; margin-top: 4px; }
.macro-bar-track { height: 3px; background: #111820; border-radius: 2px; margin-top: 10px; }
.macro-bar-fill { height: 100%; border-radius: 2px; }

.weight-block { background: #0d1219; border: 1px solid #1a2230; border-radius: 8px; padding: 20px; margin-bottom: 28px; }
.weight-svg { width: 100%; display: block; }

.comp-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
.comp-table th { font-family: 'IBM Plex Mono','Courier New',monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #2e3d50; padding: 0 0 10px 0; text-align: left; border-bottom: 1px solid #1a2230; }
.comp-table th:not(:first-child) { text-align: right; }
.comp-table td { padding: 9px 0; border-bottom: 1px solid #111820; font-size: 13px; color: #c8d0dc; }
.comp-table td:not(:first-child) { font-family: 'IBM Plex Mono','Courier New',monospace; text-align: right; }

.footer { border-top: 1px solid #1a2230; padding-top: 20px; text-align: center; font-size: 11px; color: #2e3d50; font-family: 'IBM Plex Mono','Courier New',monospace; line-height: 1.8; }
.footer a { color: #2e4a62; text-decoration: none; }
`.trim();
}

function buildHeader(data: MonthlyReportData): string {
  const pct = data.daysLogged > 0 ? (data.daysOnTarget / data.daysLogged) * 100 : 0;
  const onTrack = pct >= 50;
  const verdictClass = onTrack ? 'verdict-on-track' : 'verdict-over';
  const verdictLabel = onTrack ? 'On track' : 'Over';

  return `
  <div class="header">
    <div>
      <div class="header-brand">my-hub / calories</div>
      <div class="header-title">Monthly report</div>
    </div>
    <div class="header-meta">
      ${data.monthLabel}<br>
      ${data.totalDaysInMonth} days
      <br><span class="header-verdict ${verdictClass}">${verdictLabel}</span>
    </div>
  </div>`;
}

function buildSummary(data: MonthlyReportData): string {
  const deficitLabel =
    data.monthlyDeficit >= 0
      ? `${MINUS}${fmt(Math.abs(data.monthlyDeficit))}`
      : `+${fmt(Math.abs(data.monthlyDeficit))}`;
  const kgLabel =
    data.monthlyDeficit >= 0
      ? `\u2248 ${MINUS}${(Math.abs(data.monthlyDeficit) / 7700).toFixed(2)} kg fat`
      : `\u2248 +${(Math.abs(data.monthlyDeficit) / 7700).toFixed(2)} kg fat`;
  const sectionLabel = data.monthlyDeficit >= 0 ? 'Monthly deficit' : 'Monthly surplus';

  return `
  <div class="section-label">Summary</div>
  <div class="stat-row">
    <div class="stat-card">
      <div class="stat-label">Avg daily intake</div>
      <div class="stat-value">${fmt(data.avgDailyKcal)}<span class="stat-unit">kcal</span></div>
      <div class="stat-sub">Goal: ${fmt(data.goalMaxCalories)} kcal</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Days on target</div>
      <div class="stat-value">${data.daysOnTarget}<span class="stat-unit">/ ${data.daysLogged}</span></div>
      <div class="stat-sub">of ${data.totalDaysInMonth} days</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${sectionLabel}</div>
      <div class="stat-value">${deficitLabel}<span class="stat-unit">kcal</span></div>
      <div class="stat-sub">${kgLabel}</div>
    </div>
  </div>`;
}

function buildWeeklyBreakdown(data: MonthlyReportData): string {
  const BAR_SCALE = 4500;
  const goalLinePct = ((data.goalMaxCalories / BAR_SCALE) * 100).toFixed(1);

  const bars = data.weeks
    .map((week) => {
      if (!week.hasData) {
        return `
    <div class="bar-row">
      <div class="bar-day">${week.label}</div>
      <div class="bar-track">
        <div class="bar-goal-line" style="left:${goalLinePct}%;"></div>
      </div>
      <div class="bar-kcal">&mdash;</div>
      <div class="bar-delta" style="color:#4b5a6b;">&mdash;</div>
    </div>`;
      }

      const delta = week.avgDailyKcal - data.goalMaxCalories;
      const widthPct = Math.min((week.avgDailyKcal / BAR_SCALE) * 100, 100).toFixed(1);
      const bg = barColor(delta);
      const cls = deltaClass(delta);
      const deltaStr = delta <= 0 ? `${MINUS}${fmt(Math.abs(delta))}` : `+${fmt(delta)}`;

      return `
    <div class="bar-row">
      <div class="bar-day">${week.label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${widthPct}%; background:${bg};"></div>
        <div class="bar-goal-line" style="left:${goalLinePct}%;"></div>
      </div>
      <div class="bar-kcal">${fmt(week.avgDailyKcal)}</div>
      <div class="bar-delta ${cls}">${deltaStr}</div>
    </div>`;
    })
    .join('');

  return `
  <div class="section-label">Week-by-week calories</div>
  <div class="chart-block">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <span style="font-size:12px; color:#4b5a6b;">Avg daily intake per week vs goal (${fmt(data.goalMaxCalories)} kcal)</span>
    </div>
    ${bars}
  </div>`;
}

function buildMacros(data: MonthlyReportData): string {
  const avgKcal = data.avgDailyKcal || 1;
  const carbsPct = Math.round(((data.avgCarbs * 4) / avgKcal) * 100);
  const proteinPct = Math.round(((data.avgProtein * 4) / avgKcal) * 100);
  const fatPct = Math.round(((data.avgFat * 9) / avgKcal) * 100);

  return `
  <div class="section-label">Average macro split</div>
  <div class="macro-row">
    <div class="macro-card">
      <div class="macro-name"><span class="macro-dot" style="background:#d4924a;"></span>Carbs</div>
      <div class="macro-g">${Math.round(data.avgCarbs)}<span style="font-size:13px; color:#4b5a6b;"> g</span></div>
      <div class="macro-pct">${carbsPct}% of calories</div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${carbsPct}%; background:#d4924a;"></div></div>
    </div>
    <div class="macro-card">
      <div class="macro-name"><span class="macro-dot" style="background:#4a7fa5;"></span>Protein</div>
      <div class="macro-g">${Math.round(data.avgProtein)}<span style="font-size:13px; color:#4b5a6b;"> g</span></div>
      <div class="macro-pct">${proteinPct}% of calories</div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${proteinPct}%; background:#4a7fa5;"></div></div>
    </div>
    <div class="macro-card">
      <div class="macro-name"><span class="macro-dot" style="background:#c05a6e;"></span>Fat</div>
      <div class="macro-g">${Math.round(data.avgFat)}<span style="font-size:13px; color:#4b5a6b;"> g</span></div>
      <div class="macro-pct">${fatPct}% of calories</div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${fatPct}%; background:#c05a6e;"></div></div>
    </div>
  </div>`;
}

function buildWeightTrendChart(data: MonthlyReportData): string {
  const points = data.weightPoints;
  if (points.length < 2) {
    return `
  <div class="section-label">Weight trend</div>
  <div class="weight-block">
    <p style="font-size:12px; color:#4b5a6b;">Not enough weight measurements logged this month.</p>
  </div>`;
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yMin = parseFloat((rawMin - 0.5).toFixed(1));
  const yMax = parseFloat((rawMax + 0.5).toFixed(1));
  const yMid = parseFloat(((yMin + yMax) / 2).toFixed(1));
  const yRange = yMax - yMin || 1;

  // Map dates to x positions within 560px SVG (x 42–518)
  const monthStartMs = data.monthStart.getTime();
  const monthEndMs = data.monthEnd.getTime();
  const totalDurationMs = monthEndMs - monthStartMs || 1;

  function toX(dateStr: string): number {
    const ms = new Date(dateStr + 'T12:00:00Z').getTime();
    return 42 + ((ms - monthStartMs) / totalDurationMs) * 476;
  }

  function toY(v: number): number {
    return 72 - ((v - yMin) / yRange) * 52;
  }

  const startWeight = values[0]!;
  const endWeight = values[values.length - 1]!;
  const totalDelta = endWeight - startWeight;

  // Build polyline
  const coordPairs = points.map((p) => `${toX(p.date).toFixed(1)},${toY(p.value).toFixed(1)}`);
  const polylineStr = coordPairs.join(' ');

  const firstX = toX(points[0]!.date).toFixed(1);
  const lastX = toX(points[points.length - 1]!.date).toFixed(1);

  // Goal trajectory: from startWeight to startWeight - (monthDays/7)*goalWeeklyRateKg
  const monthDays = data.totalDaysInMonth;
  const goalEndWeight = startWeight - (monthDays / 7) * data.goalWeeklyRateKg;
  const projEndY = toY(goalEndWeight).toFixed(1);
  const projStartY = toY(startWeight).toFixed(1);

  // Data point circles
  const circles = points
    .map((p, i) => {
      const x = toX(p.date).toFixed(1);
      const y = toY(p.value).toFixed(1);
      const isLast = i === points.length - 1;
      return isLast
        ? `<circle cx="${x}" cy="${y}" r="4" fill="#4a7fa5" stroke="#4a7fa5" stroke-width="1.5"/>`
        : `<circle cx="${x}" cy="${y}" r="2.5" fill="#0d1219" stroke="#4a7fa5" stroke-width="1.5"/>`;
    })
    .join('\n      ');

  // X axis date labels: start, mid, end of month
  const midDateMs = (monthStartMs + monthEndMs) / 2;
  const midDateStr = new Date(midDateMs).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const startDateStr = data.monthStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const endDateStr = data.monthEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  const gridY1 = toY(yMax).toFixed(1);
  const gridY2 = toY(yMid).toFixed(1);
  const gridY3 = toY(yMin).toFixed(1);

  const deltaColor = totalDelta <= 0 ? '#3db87a' : '#e05a5a';
  const deltaStr = totalDelta <= 0 ? `${MINUS}${Math.abs(totalDelta).toFixed(1)}` : `+${totalDelta.toFixed(1)}`;

  return `
  <div class="section-label">Weight trend</div>
  <div class="weight-block">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:2px;">Start</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:18px; color:#e4eaf2;">${fmtWeight(startWeight)} <span style="font-size:13px; color:#4b5a6b;">kg</span></div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:2px;">Total change</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:18px; color:${deltaColor};">${deltaStr} kg</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:2px;">End</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:18px; color:#e4eaf2;">${fmtWeight(endWeight)} <span style="font-size:13px; color:#4b5a6b;">kg</span></div>
      </div>
    </div>
    <svg class="weight-svg" viewBox="0 0 560 90" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
      <defs>
        <linearGradient id="wgm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4a7fa5" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#4a7fa5" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="42" y1="${gridY1}" x2="518" y2="${gridY1}" stroke="#1a2230" stroke-width="1"/>
      <line x1="42" y1="${gridY2}" x2="518" y2="${gridY2}" stroke="#1a2230" stroke-width="1"/>
      <line x1="42" y1="${gridY3}" x2="518" y2="${gridY3}" stroke="#1a2230" stroke-width="1"/>
      <text x="0" y="${(parseFloat(gridY1) - 2).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${fmtWeight(yMax)}</text>
      <text x="0" y="${(parseFloat(gridY2) - 2).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${fmtWeight(yMid)}</text>
      <text x="0" y="${(parseFloat(gridY3) - 2).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${fmtWeight(yMin)}</text>
      <line x1="${firstX}" y1="${projStartY}" x2="${lastX}" y2="${projEndY}" stroke="#2e4a62" stroke-width="1.5" stroke-dasharray="4,3"/>
      <path d="M${coordPairs.join(' L')} L${lastX},90 L${firstX},90 Z" fill="url(#wgm)"/>
      <polyline points="${polylineStr}" fill="none" stroke="#4a7fa5" stroke-width="2"/>
      ${circles}
      <text x="42" y="88" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${startDateStr}</text>
      <text x="280" y="88" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${midDateStr}</text>
      <text x="518" y="88" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${endDateStr}</text>
      <line x1="350" y1="8" x2="370" y2="8" stroke="#4a7fa5" stroke-width="2"/>
      <text x="374" y="11" font-family="IBM Plex Mono, monospace" font-size="9" fill="#4b5a6b">Actual</text>
      <line x1="420" y1="8" x2="440" y2="8" stroke="#2e4a62" stroke-width="1.5" stroke-dasharray="4,3"/>
      <text x="444" y="11" font-family="IBM Plex Mono, monospace" font-size="9" fill="#4b5a6b">Goal</text>
    </svg>
  </div>`;
}

function buildCompositionProgress(data: MonthlyReportData): string {
  const { startMeasurements: s, endMeasurements: e } = data;

  type Row = { label: string; unit: string; start: number | null; end: number | null; decimals: number };
  const rows: Row[] = [
    { label: 'Weight', unit: 'kg', start: s.weight, end: e.weight, decimals: 1 },
    { label: 'Body fat', unit: '%', start: s.bodyFat, end: e.bodyFat, decimals: 1 },
    { label: 'Waist', unit: 'cm', start: s.waist, end: e.waist, decimals: 0 },
    { label: 'Chest', unit: 'cm', start: s.chest, end: e.chest, decimals: 0 },
    { label: 'Neck', unit: 'cm', start: s.neck, end: e.neck, decimals: 0 },
  ];

  const tableRows = rows
    .map((row) => {
      const startStr = row.start != null ? `${row.start.toFixed(row.decimals)} ${row.unit}` : '—';
      const endStr = row.end != null ? `${row.end.toFixed(row.decimals)} ${row.unit}` : '—';
      let deltaStr = '—';
      let deltaStyle = 'color:#4b5a6b;';
      if (row.start != null && row.end != null) {
        const d = row.end - row.start;
        deltaStr = d < 0 ? `${MINUS}${Math.abs(d).toFixed(row.decimals)}` : d > 0 ? `+${d.toFixed(row.decimals)}` : '0';
        deltaStyle = d < 0 ? 'color:#3db87a;' : d > 0 ? 'color:#e05a5a;' : 'color:#4b5a6b;';
      }
      return `<tr>
      <td style="color:#c8d0dc;">${row.label}</td>
      <td>${startStr}</td>
      <td>${endStr}</td>
      <td style="${deltaStyle}">${deltaStr}</td>
    </tr>`;
    })
    .join('\n    ');

  return `
  <div class="section-label">Body composition progress</div>
  <div style="margin-bottom:28px;">
    <table class="comp-table">
      <thead>
        <tr>
          <th>Measurement</th>
          <th style="text-align:right;">Start</th>
          <th style="text-align:right;">End</th>
          <th style="text-align:right;">Delta</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
}

function buildConsistency(data: MonthlyReportData): string {
  return `
  <div class="section-label">Calorie consistency</div>
  <div class="chart-block" style="margin-bottom:28px;">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Days logged</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:20px; color:#e4eaf2;">${data.daysLogged}<span style="font-size:13px; color:#4b5a6b;"> / ${data.totalDaysInMonth}</span></div>
      </div>
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Longest streak</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:20px; color:#e4eaf2;">${data.longestStreak}<span style="font-size:13px; color:#4b5a6b;"> days</span></div>
      </div>
    </div>
  </div>`;
}

function buildOutlook(data: MonthlyReportData): string {
  const dailyDeficit = data.tdee - data.goalMaxCalories;
  const projectedMonthlyKgChange = (dailyDeficit * 30) / 7700;
  const currentWeight = data.endMeasurements.weight;
  const projNextMonthWeight = currentWeight != null ? currentWeight - projectedMonthlyKgChange : null;
  const activeKcal = data.tdee - data.bmr;
  const deficitColor = dailyDeficit >= 0 ? '#3db87a' : '#e05a5a';
  const deficitStr = dailyDeficit >= 0 ? `${MINUS}${fmt(dailyDeficit)}` : `+${fmt(Math.abs(dailyDeficit))}`;

  return `
  <div class="section-label">Monthly outlook</div>
  <div class="chart-block" style="margin-bottom:28px;">
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">TDEE</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:16px; color:#e4eaf2;">${fmt(data.tdee)} <span style="font-size:11px; color:#4b5a6b;">kcal/day</span></div>
      </div>
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Target intake</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:16px; color:#e4eaf2;">${fmt(data.goalMaxCalories)} <span style="font-size:11px; color:#4b5a6b;">kcal/day</span></div>
      </div>
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Daily deficit</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:16px; color:${deficitColor};">${deficitStr} <span style="font-size:11px;">kcal</span></div>
      </div>
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Projected next month</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:16px; color:#e4eaf2;">${projNextMonthWeight != null ? fmtWeight(projNextMonthWeight) : '—'} <span style="font-size:11px; color:#4b5a6b;">kg</span></div>
      </div>
    </div>
    <div style="margin-top:14px; padding-top:14px; border-top:1px solid #1a2230; font-size:12px; color:#4b5a6b; line-height:1.7;">
      BMR ${fmt(data.bmr)} kcal &middot; Active ${fmt(activeKcal)} kcal &middot; Goal rate ${MINUS}${fmtWeight(data.goalWeeklyRateKg)} kg/week
    </div>
  </div>`;
}

function buildFooter(data: MonthlyReportData): string {
  return `
  <div class="footer">
    hub.alexiuc.dev &middot; calories module<br>
    ${data.monthLabel} &middot; Auto-generated<br>
    <a href="${data.unsubscribeUrl}">Unsubscribe</a> &middot; <a href="${data.viewInAppUrl}">View in app</a>
  </div>`;
}

export function buildMonthlyReportHtml(data: MonthlyReportData, options?: { hideFooter?: boolean }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Monthly Fitness Report</title>
<style>
${buildCss()}
</style>
</head>
<body>
<div class="email-wrapper">
${buildHeader(data)}
${buildSummary(data)}
${buildWeeklyBreakdown(data)}
${buildMacros(data)}
${buildWeightTrendChart(data)}
${buildCompositionProgress(data)}
${buildConsistency(data)}
${buildOutlook(data)}
${options?.hideFooter ? '' : buildFooter(data)}
</div>
</body>
</html>`;
}
