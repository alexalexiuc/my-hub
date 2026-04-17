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

function deltaColorHex(delta: number): string {
  if (delta <= 0) return '#3db87a';
  if (delta <= 200) return '#d4924a';
  return '#e05a5a';
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

  const CARD = 'background:#0d1219;border:1px solid #1a2230;border-radius:8px;padding:14px 16px;';

  return `
  <div class="section-label">Summary</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
      <td style="padding-right:5px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="stat-label">Avg daily intake</div>
          <div class="stat-value">${fmt(data.avgDailyKcal)}<span class="stat-unit">kcal</span></div>
          <div class="stat-sub">Goal: ${fmt(data.goalMaxCalories)} kcal</div>
        </div>
      </td>
      <td style="padding:0 3px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="stat-label">Days on target</div>
          <div class="stat-value">${data.daysOnTarget}<span class="stat-unit">/ ${data.daysLogged}</span></div>
          <div class="stat-sub">of ${data.totalDaysInMonth} days</div>
        </div>
      </td>
      <td style="padding-left:5px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="stat-label">${sectionLabel}</div>
          <div class="stat-value">${deficitLabel}<span class="stat-unit">kcal</span></div>
          <div class="stat-sub">${kgLabel}</div>
        </div>
      </td>
    </tr>
  </table>`;
}

function buildWeeklyBreakdown(data: MonthlyReportData): string {
  const BAR_SCALE = 4500;
  const goalLinePct = ((data.goalMaxCalories / BAR_SCALE) * 100).toFixed(1);

  const DAY_TD = `font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;color:#4b5a6b;white-space:nowrap;width:54px;padding-right:10px;padding-bottom:8px;vertical-align:middle;`;
  const KCAL_TD = `font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;color:#4b5a6b;text-align:right;white-space:nowrap;width:50px;padding-right:10px;padding-bottom:8px;vertical-align:middle;`;
  const DELTA_TD_BASE = `font-family:'IBM Plex Mono','Courier New',monospace;font-size:10px;text-align:right;white-space:nowrap;width:50px;padding-bottom:8px;vertical-align:middle;`;
  const TRACK = `height:22px;background:#111820;border-radius:3px;position:relative;overflow:visible;`;

  const bars = data.weeks
    .map(week => {
      if (!week.hasData) {
        return `
    <tr>
      <td style="${DAY_TD}">${week.label}</td>
      <td style="padding-right:10px;padding-bottom:8px;vertical-align:middle;">
        <div style="${TRACK}">
          <div style="position:absolute;top:-4px;bottom:-4px;width:1px;background:#2e4a62;left:${goalLinePct}%;"></div>
        </div>
      </td>
      <td style="${KCAL_TD}">&mdash;</td>
      <td style="${DELTA_TD_BASE}color:#4b5a6b;">&mdash;</td>
    </tr>`;
      }

      const delta = week.avgDailyKcal - data.goalMaxCalories;
      const widthPct = Math.min((week.avgDailyKcal / BAR_SCALE) * 100, 100).toFixed(1);
      const deltaStr = delta <= 0 ? `${MINUS}${fmt(Math.abs(delta))}` : `+${fmt(delta)}`;

      return `
    <tr>
      <td style="${DAY_TD}">${week.label}</td>
      <td style="padding-right:10px;padding-bottom:8px;vertical-align:middle;">
        <div style="${TRACK}">
          <div style="width:${widthPct}%;height:22px;background:${barColor(delta)};border-radius:3px;"></div>
          <div style="position:absolute;top:-4px;bottom:-4px;width:1px;background:#2e4a62;left:${goalLinePct}%;"></div>
        </div>
      </td>
      <td style="${KCAL_TD}">${fmt(week.avgDailyKcal)}</td>
      <td style="${DELTA_TD_BASE}color:${deltaColorHex(delta)};">${deltaStr}</td>
    </tr>`;
    })
    .join('');

  return `
  <div class="section-label">Week-by-week calories</div>
  <div class="chart-block">
    <div style="font-size:12px;color:#4b5a6b;margin-bottom:14px;">Avg daily intake per week vs goal (${fmt(data.goalMaxCalories)} kcal)</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${bars}
    </table>
  </div>`;
}

function buildMacros(data: MonthlyReportData): string {
  const avgKcal = data.avgDailyKcal || 1;
  const carbsPct = Math.round(((data.avgCarbs * 4) / avgKcal) * 100);
  const proteinPct = Math.round(((data.avgProtein * 4) / avgKcal) * 100);
  const fatPct = Math.round(((data.avgFat * 9) / avgKcal) * 100);

  const CARD = 'background:#0d1219;border:1px solid #1a2230;border-radius:8px;padding:14px 16px;';

  return `
  <div class="section-label">Average macro split</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
      <td style="padding-right:5px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="macro-name"><span class="macro-dot" style="background:#d4924a;"></span>Carbs</div>
          <div class="macro-g">${Math.round(data.avgCarbs)}<span style="font-size:13px;color:#4b5a6b;"> g</span></div>
          <div class="macro-pct">${carbsPct}% of calories</div>
          <div style="height:3px;background:#111820;border-radius:2px;margin-top:10px;"><div style="width:${carbsPct}%;height:3px;background:#d4924a;border-radius:2px;"></div></div>
        </div>
      </td>
      <td style="padding:0 3px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="macro-name"><span class="macro-dot" style="background:#4a7fa5;"></span>Protein</div>
          <div class="macro-g">${Math.round(data.avgProtein)}<span style="font-size:13px;color:#4b5a6b;"> g</span></div>
          <div class="macro-pct">${proteinPct}% of calories</div>
          <div style="height:3px;background:#111820;border-radius:2px;margin-top:10px;"><div style="width:${proteinPct}%;height:3px;background:#4a7fa5;border-radius:2px;"></div></div>
        </div>
      </td>
      <td style="padding-left:5px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="macro-name"><span class="macro-dot" style="background:#c05a6e;"></span>Fat</div>
          <div class="macro-g">${Math.round(data.avgFat)}<span style="font-size:13px;color:#4b5a6b;"> g</span></div>
          <div class="macro-pct">${fatPct}% of calories</div>
          <div style="height:3px;background:#111820;border-radius:2px;margin-top:10px;"><div style="width:${fatPct}%;height:3px;background:#c05a6e;border-radius:2px;"></div></div>
        </div>
      </td>
    </tr>
  </table>`;
}

function buildMonthlyWeightChartImg(
  points: Array<{ date: string; value: number }>,
  startWeight: number,
  goalEndWeight: number,
): string {
  const values = points.map(p => p.value);
  const labels = points.map(p =>
    new Date(p.date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
  );
  const lastIndex = values.length - 1;

  // Projected goal line spanning first → last measurement
  const projectedData: (number | null)[] = values.map((_, i) =>
    i === 0 ? startWeight : i === lastIndex ? parseFloat(goalEndWeight.toFixed(2)) : null,
  );

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '',
          data: values,
          borderColor: '#4a7fa5',
          backgroundColor: 'rgba(74,127,165,0.15)',
          pointBackgroundColor: '#4a7fa5',
          pointRadius: values.map((_, i) => (i === lastIndex ? 4 : 2.5)),
          fill: true,
          tension: 0.3,
        },
        {
          label: '',
          data: projectedData,
          borderColor: '#2e4a62',
          borderDash: [4, 3],
          pointRadius: 0,
          fill: false,
          tension: 0,
          spanGaps: true,
        },
      ],
    },
    options: {
      legend: { display: false },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#4b5a6b', font: { size: 8 }, maxRotation: 0 },
          grid: { color: '#1a2230' },
          border: { color: '#1a2230' },
        },
        y: {
          ticks: { color: '#4b5a6b', font: { size: 8 } },
          grid: { color: '#1a2230' },
          border: { color: '#1a2230' },
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  const chartUrl = `https://quickchart.io/chart?v=3&c=${encoded}&w=520&h=130&backgroundColor=%230d1219`;
  return `<img src="${chartUrl}" width="520" style="width:100%;display:block;" alt="Weight trend chart" />`;
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

  const values = points.map(p => p.value);
  const startWeight = values[0]!;
  const endWeight = values[values.length - 1]!;
  const totalDelta = endWeight - startWeight;

  const goalEndWeight = startWeight - (data.totalDaysInMonth / 7) * data.goalWeeklyRateKg;

  const deltaColor = totalDelta <= 0 ? '#3db87a' : '#e05a5a';
  const deltaStr = totalDelta <= 0 ? `${MINUS}${Math.abs(totalDelta).toFixed(1)}` : `+${totalDelta.toFixed(1)}`;

  return `
  <div class="section-label">Weight trend</div>
  <div class="weight-block">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="width:33%;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:2px;">Start</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:18px;color:#e4eaf2;">${fmtWeight(startWeight)} <span style="font-size:13px;color:#4b5a6b;">kg</span></div>
        </td>
        <td style="width:33%;text-align:center;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:2px;">Total change</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:18px;color:${deltaColor};">${deltaStr} kg</div>
        </td>
        <td style="width:33%;text-align:right;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:2px;">End</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:18px;color:#e4eaf2;">${fmtWeight(endWeight)} <span style="font-size:13px;color:#4b5a6b;">kg</span></div>
        </td>
      </tr>
    </table>
    ${buildMonthlyWeightChartImg(points, startWeight, goalEndWeight)}
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
    .map(row => {
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
