import type { WeeklyReportData, WeightPoint } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MINUS = '\u2212'; // U+2212 proper minus sign

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtWeight(n: number): string {
  return n.toFixed(1);
}

function signedKcal(delta: number): string {
  return delta <= 0 ? `${MINUS}${fmt(Math.abs(delta))}` : `+${fmt(delta)}`;
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

function weekRange(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} \u2013 ${fmt(end)}`;
}

function getWeekDayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

// ─── CSS ────────────────────────────────────────────────────────────────────

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
.header-brand {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #4a7fa5;
}
.header-title {
  font-size: 22px;
  font-weight: 300;
  color: #e4eaf2;
  margin-top: 6px;
  letter-spacing: -0.02em;
}
.header-meta {
  text-align: right;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 11px;
  color: #4b5a6b;
}
.header-verdict {
  display: inline-block;
  margin-top: 6px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.05em;
}
.verdict-on-track { background: #0e2a1f; color: #3db87a; border: 1px solid #1a4a33; }
.verdict-over     { background: #2a1010; color: #e05a5a; border: 1px solid #4a1a1a; }

.section-label {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #2e3d50;
  margin-bottom: 12px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 28px;
}
.stat-card {
  background: #0d1219;
  border: 1px solid #1a2230;
  border-radius: 8px;
  padding: 14px 16px;
}
.stat-label { font-size: 11px; color: #4b5a6b; margin-bottom: 6px; }
.stat-value {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 20px;
  font-weight: 500;
  color: #e4eaf2;
  letter-spacing: -0.02em;
}
.stat-unit { font-size: 12px; color: #4b5a6b; margin-left: 2px; }
.stat-sub { font-size: 11px; color: #4b5a6b; margin-top: 4px; }
.c-green { color: #3db87a; }
.c-red   { color: #e05a5a; }
.c-amber { color: #d4924a; }
.c-blue  { color: #4a7fa5; }

.chart-block {
  background: #0d1219;
  border: 1px solid #1a2230;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 28px;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.bar-day {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 11px;
  color: #4b5a6b;
  width: 30px;
  flex-shrink: 0;
}
.bar-track {
  flex: 1;
  height: 22px;
  background: #111820;
  border-radius: 3px;
  position: relative;
  overflow: visible;
}
.bar-fill {
  height: 100%;
  border-radius: 3px;
  position: relative;
}
.bar-goal-line {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 1px;
  background: #2e4a62;
}
.bar-kcal {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 11px;
  color: #4b5a6b;
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}
.bar-delta {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 10px;
  width: 44px;
  text-align: right;
  flex-shrink: 0;
}

.macro-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 28px;
}
.macro-card {
  background: #0d1219;
  border: 1px solid #1a2230;
  border-radius: 8px;
  padding: 14px 16px;
}
.macro-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
  vertical-align: middle;
}
.macro-name { font-size: 12px; color: #6b7d90; margin-bottom: 8px; }
.macro-g {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 20px;
  font-weight: 500;
  color: #e4eaf2;
}
.macro-pct { font-size: 12px; color: #4b5a6b; margin-top: 4px; }
.macro-bar-track {
  height: 3px;
  background: #111820;
  border-radius: 2px;
  margin-top: 10px;
}
.macro-bar-fill { height: 100%; border-radius: 2px; }

.weight-block {
  background: #0d1219;
  border: 1px solid #1a2230;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 28px;
}
.weight-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}
.weight-main {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 28px;
  font-weight: 500;
  color: #e4eaf2;
  letter-spacing: -0.02em;
}
.weight-delta-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 12px;
  font-weight: 500;
  margin-top: 4px;
}
.weight-svg { width: 100%; display: block; }

.measure-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 28px;
}
.measure-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0d1219;
  border: 1px solid #1a2230;
  border-radius: 6px;
  padding: 10px 14px;
}
.measure-name { font-size: 12px; color: #4b5a6b; }
.measure-val {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 14px;
  color: #e4eaf2;
}

.footer {
  border-top: 1px solid #1a2230;
  padding-top: 20px;
  text-align: center;
  font-size: 11px;
  color: #2e3d50;
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  line-height: 1.8;
}
.footer a { color: #2e4a62; text-decoration: none; }
`.trim();
}

// ─── Section builders ────────────────────────────────────────────────────────

function buildHeader(data: WeeklyReportData): string {
  const daysWithData = data.days.filter((d) => d.hasData);
  const avgDailyKcal = daysWithData.length > 0 ? daysWithData.reduce((s, d) => s + d.kcal, 0) / daysWithData.length : 0;
  const onTrack = avgDailyKcal <= data.goalMaxCalories;
  const verdictClass = onTrack ? 'verdict-on-track' : 'verdict-over';
  const verdictLabel = onTrack ? 'On track' : 'Over';

  return `
  <div class="header">
    <div>
      <div class="header-brand">my-hub / calories</div>
      <div class="header-title">Weekly report</div>
    </div>
    <div class="header-meta">
      ${weekRange(data.weekStart, data.weekEnd)}<br>
      Week ${data.weekNumber}
      <br><span class="header-verdict ${verdictClass}">${verdictLabel}</span>
    </div>
  </div>`;
}

function buildSummary(data: WeeklyReportData): string {
  const daysWithData = data.days.filter((d) => d.hasData);
  const totalKcal = daysWithData.reduce((s, d) => s + d.kcal, 0);
  const avgDailyKcal = daysWithData.length > 0 ? Math.round(totalKcal / daysWithData.length) : 0;

  const daysOnTarget = data.days.filter((d) => d.hasData && d.kcal <= data.goalMaxCalories).length;
  const daysOver = data.days.filter((d) => d.hasData && d.kcal > data.goalMaxCalories).length;
  const daysUnder = data.days.filter((d) => d.hasData && d.kcal < data.goalMaxCalories).length;

  // Deficit: positive = deficit (ate less than goal), negative = surplus
  const weeklyDeficit = data.goalMaxCalories * 7 - data.days.reduce((s, d) => s + (d.hasData ? d.kcal : 0), 0);
  const deficitKg = weeklyDeficit / 7700;

  const deficitLabel =
    weeklyDeficit >= 0 ? `${MINUS}${fmt(Math.abs(weeklyDeficit))}` : `+${fmt(Math.abs(weeklyDeficit))}`;
  const kgLabel =
    deficitKg >= 0
      ? `\u2248 ${MINUS}${Math.abs(deficitKg).toFixed(2)} kg fat`
      : `\u2248 +${Math.abs(deficitKg).toFixed(2)} kg fat`;

  const deficitSectionLabel = weeklyDeficit >= 0 ? 'Weekly deficit' : 'Weekly surplus';

  return `
  <div class="section-label">Summary</div>
  <div class="stat-row">
    <div class="stat-card">
      <div class="stat-label">Avg daily intake</div>
      <div class="stat-value">${fmt(avgDailyKcal)}<span class="stat-unit">kcal</span></div>
      <div class="stat-sub">Goal: ${fmt(data.goalMaxCalories)} kcal</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Days on target</div>
      <div class="stat-value">${daysOnTarget}<span class="stat-unit">/ 7</span></div>
      <div class="stat-sub"><span class="c-red">${daysOver} over</span> &middot; <span class="c-green">${daysUnder} under</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-label">${deficitSectionLabel}</div>
      <div class="stat-value">${deficitLabel}<span class="stat-unit">kcal</span></div>
      <div class="stat-sub">${kgLabel}</div>
    </div>
  </div>`;
}

function buildBarChart(data: WeeklyReportData): string {
  const BAR_SCALE = 4500;
  const goalLinePct = ((data.goalMaxCalories / BAR_SCALE) * 100).toFixed(1);

  const bars = data.days
    .map((day) => {
      const dayLabel = getWeekDayLabel(day.date);
      if (!day.hasData) {
        return `
    <div class="bar-row">
      <div class="bar-day">${dayLabel}</div>
      <div class="bar-track">
        <div class="bar-goal-line" style="left:${goalLinePct}%;"></div>
      </div>
      <div class="bar-kcal">&mdash;</div>
      <div class="bar-delta" style="color:#4b5a6b;">&mdash;</div>
    </div>`;
      }

      const delta = day.kcal - data.goalMaxCalories;
      const widthPct = Math.min((day.kcal / BAR_SCALE) * 100, 100).toFixed(1);
      const bg = barColor(delta);
      const cls = deltaClass(delta);
      const deltaStr = signedKcal(delta);

      return `
    <div class="bar-row">
      <div class="bar-day">${dayLabel}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${widthPct}%; background:${bg};"></div>
        <div class="bar-goal-line" style="left:${goalLinePct}%;"></div>
      </div>
      <div class="bar-kcal">${fmt(day.kcal)}</div>
      <div class="bar-delta ${cls}">${deltaStr}</div>
    </div>`;
    })
    .join('');

  return `
  <div class="section-label">Daily calories</div>
  <div class="chart-block">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <span style="font-size:12px; color:#4b5a6b;">Goal: ${fmt(data.goalMaxCalories)} kcal/day</span>
      <span style="font-size:11px; color:#2e4a62;">&verbar; = goal</span>
    </div>
    ${bars}
  </div>`;
}

function buildMacros(data: WeeklyReportData): string {
  const daysWithData = data.days.filter((d) => d.hasData);
  const count = daysWithData.length || 1;
  const avgKcal = daysWithData.reduce((s, d) => s + d.kcal, 0) / count || 1;
  const avgCarbs = Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / count);
  const avgProtein = Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / count);
  const avgFat = Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / count);

  const carbsPct = Math.round(((avgCarbs * 4) / avgKcal) * 100);
  const proteinPct = Math.round(((avgProtein * 4) / avgKcal) * 100);
  const fatPct = Math.round(((avgFat * 9) / avgKcal) * 100);

  return `
  <div class="section-label">Average macro split</div>
  <div class="macro-row">
    <div class="macro-card">
      <div class="macro-name"><span class="macro-dot" style="background:#d4924a;"></span>Carbs</div>
      <div class="macro-g">${avgCarbs}<span style="font-size:13px; color:#4b5a6b;"> g</span></div>
      <div class="macro-pct">${carbsPct}% of calories</div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${carbsPct}%; background:#d4924a;"></div></div>
    </div>
    <div class="macro-card">
      <div class="macro-name"><span class="macro-dot" style="background:#4a7fa5;"></span>Protein</div>
      <div class="macro-g">${avgProtein}<span style="font-size:13px; color:#4b5a6b;"> g</span></div>
      <div class="macro-pct">${proteinPct}% of calories</div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${proteinPct}%; background:#4a7fa5;"></div></div>
    </div>
    <div class="macro-card">
      <div class="macro-name"><span class="macro-dot" style="background:#c05a6e;"></span>Fat</div>
      <div class="macro-g">${avgFat}<span style="font-size:13px; color:#4b5a6b;"> g</span></div>
      <div class="macro-pct">${fatPct}% of calories</div>
      <div class="macro-bar-track"><div class="macro-bar-fill" style="width:${fatPct}%; background:#c05a6e;"></div></div>
    </div>
  </div>`;
}

function buildWeightSparkline(data: WeeklyReportData): string {
  const points = data.weightPoints;

  // Header info
  const currentWeight = points.length > 0 ? points[points.length - 1]!.value : null;
  const priorWeight = data.priorWeekWeight;
  const weekDelta = currentWeight !== null && priorWeight !== null ? currentWeight - priorWeight : null;

  const projectedEndWeight = currentWeight !== null ? currentWeight - data.goalWeeklyRateKg : null;

  const deltaTagHtml =
    weekDelta !== null
      ? `<span class="weight-delta-tag" style="background:${weekDelta <= 0 ? '#0e2a1f' : '#2a1010'}; color:${weekDelta <= 0 ? '#3db87a' : '#e05a5a'}; border:1px solid ${weekDelta <= 0 ? '#1a4a33' : '#4a1a1a'};">
          ${weekDelta <= 0 ? MINUS : '+'}${Math.abs(weekDelta).toFixed(2)} kg this week
        </span>`
      : '';

  const headerHtml = `
    <div class="weight-header">
      <div>
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Current weight</div>
        <div class="weight-main">${currentWeight !== null ? fmtWeight(currentWeight) : '—'} <span style="font-size:16px; color:#4b5a6b; font-weight:400;">kg</span></div>
        ${deltaTagHtml}
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Projected end-of-week</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:18px; color:#e4eaf2;">${projectedEndWeight !== null ? fmtWeight(projectedEndWeight) : '—'} kg</div>
        <div style="font-size:11px; color:#4b5a6b; margin-top:4px;">Weekly target: ${MINUS}${fmtWeight(data.goalWeeklyRateKg)} kg</div>
      </div>
    </div>`;

  // Sparkline SVG (only if ≥ 2 measurements)
  let svgHtml: string;
  if (points.length < 2) {
    svgHtml = `<p style="font-size:12px; color:#4b5a6b;">No weight measurements logged this week.</p>`;
  } else {
    svgHtml = buildSparklineSvg(points, data);
  }

  return `
  <div class="section-label">Weight progress</div>
  <div class="weight-block">
    ${headerHtml}
    ${svgHtml}
  </div>`;
}

function buildSparklineSvg(points: WeightPoint[], data: WeeklyReportData): string {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Map weekStart dates to x positions
  const xPositions = [42, 125, 208, 290, 373, 456, 518];

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yMin = parseFloat((rawMin - 0.3).toFixed(1));
  const yMax = parseFloat((rawMax + 0.3).toFixed(1));
  const yMid = parseFloat(((yMin + yMax) / 2).toFixed(1));
  const yRange = yMax - yMin || 1;

  function toY(v: number): number {
    return 80 - ((v - yMin) / yRange) * 58;
  }

  // Build a map of day index → weight value
  const dayValues = new Map<number, number>();
  for (const pt of points) {
    const d = new Date(pt.date + 'T12:00:00Z');
    const weekStartMs = data.weekStart.getTime();
    const dayIndex = Math.round((d.getTime() - weekStartMs) / 86400000);
    if (dayIndex >= 0 && dayIndex < 7) {
      dayValues.set(dayIndex, pt.value);
    }
  }

  // Build polyline points for actual data
  const actualPoints: Array<[number, number]> = [];
  for (const [idx, val] of dayValues.entries()) {
    actualPoints.push([xPositions[idx]!, toY(val)]);
  }
  actualPoints.sort((a, b) => a[0] - b[0]);

  const polylineCoords = actualPoints.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' ');

  // Area fill path
  const firstPt = actualPoints[0]!;
  const lastPt = actualPoints[actualPoints.length - 1]!;

  // Projected line: from Monday to Sunday
  const mondayWeight = dayValues.get(0) ?? values[0]!;
  const projectedSundayWeight = mondayWeight - data.goalWeeklyRateKg;
  const projStartY = toY(mondayWeight).toFixed(1);
  const projEndY = toY(projectedSundayWeight).toFixed(1);

  // Data point circles
  const circles = actualPoints
    .map(([x, y], i) => {
      const isLast = i === actualPoints.length - 1;
      return isLast
        ? `<circle cx="${x}" cy="${y.toFixed(1)}" r="4" fill="#4a7fa5" stroke="#4a7fa5" stroke-width="1.5"/>`
        : `<circle cx="${x}" cy="${y.toFixed(1)}" r="3.5" fill="#0d1219" stroke="#4a7fa5" stroke-width="1.5"/>`;
    })
    .join('\n      ');

  // X axis labels
  const xLabels = DAY_LABELS.map(
    (label, i) =>
      `<text x="${xPositions[i]}" y="88" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${label}</text>`,
  ).join('\n      ');

  // Grid lines at yMin, yMid, yMax positions
  const gridY1 = toY(yMax).toFixed(1);
  const gridY2 = toY(yMid).toFixed(1);
  const gridY3 = toY(yMin).toFixed(1);

  return `<svg class="weight-svg" viewBox="0 0 560 90" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4a7fa5" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#4a7fa5" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${gridY1}" x2="560" y2="${gridY1}" stroke="#1a2230" stroke-width="1"/>
      <line x1="0" y1="${gridY2}" x2="560" y2="${gridY2}" stroke="#1a2230" stroke-width="1"/>
      <line x1="0" y1="${gridY3}" x2="560" y2="${gridY3}" stroke="#1a2230" stroke-width="1"/>
      <text x="0" y="${(parseFloat(gridY1) - 2).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${fmtWeight(yMax)}</text>
      <text x="0" y="${(parseFloat(gridY2) - 2).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${fmtWeight(yMid)}</text>
      <text x="0" y="${(parseFloat(gridY3) - 2).toFixed(1)}" font-family="IBM Plex Mono, monospace" font-size="9" fill="#2e3d50">${fmtWeight(yMin)}</text>
      <line x1="42" y1="${projStartY}" x2="518" y2="${projEndY}" stroke="#2e4a62" stroke-width="1.5" stroke-dasharray="4,3"/>
      <path d="M${polylineCoords.split(' ').join(' L')} L${lastPt[0]},90 L${firstPt[0]},90 Z" fill="url(#wg)"/>
      <polyline points="${polylineCoords}" fill="none" stroke="#4a7fa5" stroke-width="2"/>
      ${circles}
      ${xLabels}
      <line x1="350" y1="8" x2="370" y2="8" stroke="#4a7fa5" stroke-width="2"/>
      <text x="374" y="11" font-family="IBM Plex Mono, monospace" font-size="9" fill="#4b5a6b">Actual</text>
      <line x1="420" y1="8" x2="440" y2="8" stroke="#2e4a62" stroke-width="1.5" stroke-dasharray="4,3"/>
      <text x="444" y="11" font-family="IBM Plex Mono, monospace" font-size="9" fill="#4b5a6b">Projected</text>
    </svg>`;
}

function buildMeasurements(data: WeeklyReportData): string {
  const m = data.latestMeasurements;
  const fmtVal = (v: number | null | undefined, decimals = 1) => (v != null ? v.toFixed(decimals) : '—');

  const weightDelta = m['weight'] != null && data.priorWeekWeight != null ? m['weight'] - data.priorWeekWeight : null;

  const deltaCell =
    weightDelta !== null
      ? `<div class="measure-row" style="border-color:#1e3028;">
          <span class="measure-name" style="color:#3db87a;">Week delta</span>
          <span class="measure-val" style="color:#3db87a; font-size:13px;">${weightDelta <= 0 ? MINUS : '+'}${Math.abs(weightDelta).toFixed(2)} kg</span>
        </div>`
      : `<div class="measure-row">
          <span class="measure-name">Week delta</span>
          <span class="measure-val" style="font-size:12px; color:#4b5a6b;">No prior data</span>
        </div>`;

  return `
  <div class="section-label">Body measurements</div>
  <div class="measure-grid">
    <div class="measure-row">
      <span class="measure-name">Body fat</span>
      <span class="measure-val">${fmtVal(m['body_fat'])}<span style="font-size:11px; color:#4b5a6b;"> %</span></span>
    </div>
    <div class="measure-row">
      <span class="measure-name">Weight</span>
      <span class="measure-val">${fmtVal(m['weight'])}<span style="font-size:11px; color:#4b5a6b;"> kg</span></span>
    </div>
    <div class="measure-row">
      <span class="measure-name">Waist</span>
      <span class="measure-val">${fmtVal(m['waist'], 0)}<span style="font-size:11px; color:#4b5a6b;"> cm</span></span>
    </div>
    <div class="measure-row">
      <span class="measure-name">Chest</span>
      <span class="measure-val">${fmtVal(m['chest'], 0)}<span style="font-size:11px; color:#4b5a6b;"> cm</span></span>
    </div>
    <div class="measure-row">
      <span class="measure-name">Neck</span>
      <span class="measure-val">${fmtVal(m['neck'], 0)}<span style="font-size:11px; color:#4b5a6b;"> cm</span></span>
    </div>
    ${deltaCell}
  </div>`;
}

function buildOutlook(data: WeeklyReportData): string {
  const currentWeight = data.latestMeasurements['weight'];
  const projectedWeight = currentWeight != null ? currentWeight - data.goalWeeklyRateKg : null;
  const dailyDeficit = data.tdee - data.goalMaxCalories;
  const deficitColor = dailyDeficit >= 0 ? '#3db87a' : '#e05a5a';
  const deficitStr = dailyDeficit >= 0 ? `${MINUS}${fmt(dailyDeficit)}` : `+${fmt(Math.abs(dailyDeficit))}`;
  // Active = TDEE - BMR
  const activeKcal = data.tdee - data.bmr;

  return `
  <div class="section-label">Next week outlook</div>
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
        <div style="font-size:11px; color:#4b5a6b; margin-bottom:4px;">Projected weight</div>
        <div style="font-family:'IBM Plex Mono','Courier New',monospace; font-size:16px; color:#e4eaf2;">${projectedWeight != null ? fmtWeight(projectedWeight) : '—'} <span style="font-size:11px; color:#4b5a6b;">kg</span></div>
      </div>
    </div>
    <div style="margin-top:14px; padding-top:14px; border-top:1px solid #1a2230; font-size:12px; color:#4b5a6b; line-height:1.7;">
      BMR ${fmt(data.bmr)} kcal &middot; Active ${fmt(activeKcal)} kcal &middot; Goal rate ${MINUS}${fmtWeight(data.goalWeeklyRateKg)} kg/week
    </div>
  </div>`;
}

function buildFooter(data: WeeklyReportData): string {
  return `
  <div class="footer">
    hub.alexiuc.dev &middot; calories module<br>
    Week ${data.weekNumber}, ${data.year} &middot; Auto-generated<br>
    <a href="#">Unsubscribe</a> &middot; <a href="#">View in app</a>
  </div>`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function buildWeeklyReportHtml(data: WeeklyReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Weekly Fitness Report</title>
<style>
${buildCss()}
</style>
</head>
<body>
<div class="email-wrapper">
${buildHeader(data)}
${buildSummary(data)}
${buildBarChart(data)}
${buildMacros(data)}
${buildWeightSparkline(data)}
${buildMeasurements(data)}
${buildOutlook(data)}
${buildFooter(data)}
</div>
</body>
</html>`;
}
