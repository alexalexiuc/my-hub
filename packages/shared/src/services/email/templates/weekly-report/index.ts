import { MeasurementTypes } from '../../../../constants';
import type { BuildWeeklyReportHtmlData, WeightPoint } from './types';

// ─── Helpers ────────────────────────────────────────────────────────────────

const MINUS = '\u2212'; // U+2212 proper minus sign

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function fmtWeight(n: number): string {
  return n.toFixed(1);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function signedKcal(delta: number): string {
  return delta <= 0 ? `${MINUS}${fmt(Math.abs(delta))}` : `+${fmt(delta)}`;
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

function weekRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)} \u2013 ${fmt(end)}`;
}

function getWeekDayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function buildDayWeightValues(points: WeightPoint[], weekStart: Date): (number | null)[] {
  const dayValues: (number | null)[] = new Array(7).fill(null);
  const weekStartMs = new Date(weekStart.toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
  for (const pt of points) {
    const d = new Date(pt.date + 'T00:00:00Z');
    const idx = Math.floor((d.getTime() - weekStartMs) / 86400000);
    if (idx >= 0 && idx < 7) dayValues[idx] = pt.value;
  }
  return dayValues;
}

function getWeekWeightSummary(data: BuildWeeklyReportHtmlData): {
  weekStartWeight: number | null;
  projectedEndWeight: number | null;
  actualEndWeight: number | null;
  projectionDelta: number | null;
  dayValues: (number | null)[];
} {
  const dayValues = buildDayWeightValues(data.weightPoints, data.weekStart);
  const firstLoggedThisWeek = dayValues.find(v => v !== null) ?? null;
  const weekStartWeight = dayValues[0] ?? data.priorWeekWeight ?? firstLoggedThisWeek;
  const actualEndWeight = dayValues.reduce<number | null>((last, v) => (v !== null ? v : last), null);
  const projectedEndWeight =
    weekStartWeight !== null ? parseFloat((weekStartWeight - data.goalWeeklyRateKg).toFixed(2)) : null;
  const projectionDelta =
    actualEndWeight !== null && projectedEndWeight !== null ? actualEndWeight - projectedEndWeight : null;

  return {
    weekStartWeight,
    projectedEndWeight,
    actualEndWeight,
    projectionDelta,
    dayValues,
  };
}

function getWeeklyAdherenceStats(data: BuildWeeklyReportHtmlData): {
  loggedDays: number;
  daysOnTarget: number;
  onTargetRate: number;
  avgDailyKcal: number;
  weekendDrift: number | null;
  biggestOverLabel: string | null;
  biggestOverDelta: number | null;
} {
  const daysWithData = data.days.filter(d => d.hasData);
  const loggedDays = daysWithData.length;
  const daysOnTarget = data.days.filter(d => d.hasData && d.kcal <= data.goalMaxCalories).length;
  const onTargetRate = loggedDays > 0 ? daysOnTarget / loggedDays : 0;
  const avgDailyKcal = loggedDays > 0 ? daysWithData.reduce((s, d) => s + d.kcal, 0) / loggedDays : 0;

  const weekdays = data.days.slice(0, 5).filter(d => d.hasData);
  const weekend = data.days.slice(5, 7).filter(d => d.hasData);
  const weekdayAvg = weekdays.length > 0 ? weekdays.reduce((s, d) => s + d.kcal, 0) / weekdays.length : null;
  const weekendAvg = weekend.length > 0 ? weekend.reduce((s, d) => s + d.kcal, 0) / weekend.length : null;
  const weekendDrift = weekendAvg !== null && weekdayAvg !== null ? weekendAvg - weekdayAvg : null;

  const overDays = data.days
    .filter(d => d.hasData)
    .map(d => ({ day: getWeekDayLabel(d.date), delta: d.kcal - data.goalMaxCalories }))
    .filter(d => d.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const biggestOver = overDays[0] ?? null;

  return {
    loggedDays,
    daysOnTarget,
    onTargetRate,
    avgDailyKcal,
    weekendDrift,
    biggestOverLabel: biggestOver?.day ?? null,
    biggestOverDelta: biggestOver?.delta ?? null,
  };
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

function buildHeader(data: BuildWeeklyReportHtmlData): string {
  const daysWithData = data.days.filter(d => d.hasData);
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

function buildCoachingSummary(data: BuildWeeklyReportHtmlData): string {
  const adherence = getWeeklyAdherenceStats(data);
  const weight = getWeekWeightSummary(data);
  const daysWithData = data.days.filter(d => d.hasData);
  const totalKcal = daysWithData.reduce((s, d) => s + d.kcal, 0);
  const targetDelta = totalKcal - data.goalMaxCalories * daysWithData.length;
  const targetDeltaKg = targetDelta / 7700;

  const momentumLabel =
    adherence.loggedDays >= 6 && adherence.onTargetRate >= 0.6
      ? 'Strong consistency'
      : adherence.loggedDays >= 4
        ? 'Good base'
        : 'Rebuild consistency';
  const momentumTone =
    adherence.loggedDays >= 6 && adherence.onTargetRate >= 0.6
      ? 'color:#3db87a;background:#0e2a1f;border-color:#1a4a33;'
      : adherence.loggedDays >= 4
        ? 'color:#d4924a;background:#2a2312;border-color:#4d3a1d;'
        : 'color:#e05a5a;background:#2a1010;border-color:#4a1a1a;';

  const driftNote =
    adherence.weekendDrift !== null
      ? adherence.weekendDrift > 200
        ? `Weekend drift: +${fmt(adherence.weekendDrift)} kcal/day vs weekdays.`
        : adherence.weekendDrift < -200
          ? `Weekend intake stayed tighter than weekdays (${MINUS}${fmt(Math.abs(adherence.weekendDrift))} kcal/day).`
          : 'Weekend and weekday intake were stable.'
      : 'Not enough weekday/weekend logs to detect drift.';

  const projectionNote =
    weight.projectionDelta !== null
      ? weight.projectionDelta <= 0
        ? `Scale finished ${MINUS}${Math.abs(weight.projectionDelta).toFixed(2)} kg better than projection.`
        : `Scale finished +${Math.abs(weight.projectionDelta).toFixed(2)} kg above projection.`
      : 'Need more weigh-ins to compare actual vs projection.';

  const CARD = 'background:#0d1219;border:1px solid #1a2230;border-radius:8px;padding:14px 16px;height:120px;';
  const targetDeltaLabel = fmt(Math.abs(targetDelta));
  const targetDeltaTitle =
    targetDelta > 0 ? 'Calories over target' : targetDelta < 0 ? 'Calories under target' : 'Exactly on target';
  const targetDeltaSubLabel =
    targetDelta > 0
      ? `Finished above goal across ${daysWithData.length} logged day${daysWithData.length === 1 ? '' : 's'}`
      : targetDelta < 0
        ? `Finished below goal across ${daysWithData.length} logged day${daysWithData.length === 1 ? '' : 's'}`
        : `Matched goal across ${daysWithData.length} logged day${daysWithData.length === 1 ? '' : 's'}`;
  const targetDeltaKgLabel =
    targetDelta > 0
      ? `\u2248 +${Math.abs(targetDeltaKg).toFixed(2)} kg fat`
      : targetDelta < 0
        ? `\u2248 ${MINUS}${Math.abs(targetDeltaKg).toFixed(2)} kg fat`
        : 'No net difference';

  return `
  <div class="section-label">Summary</div>
  <div class="chart-block" style="padding:16px 18px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px;">
      <div style="font-size:14px;color:#e4eaf2;line-height:1.5;">${momentumLabel}. Keep what works, then fix the biggest leak.</div>
      <span style="display:inline-block;padding:3px 10px;border-radius:20px;border:1px solid;${momentumTone}font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;font-weight:500;white-space:nowrap;">${adherence.loggedDays}/7 logged</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="width:33%;padding-right:6px;vertical-align:top;">
          <div style="${CARD}">
            <div class="stat-label">Avg daily intake</div>
            <div class="stat-value">${fmt(adherence.avgDailyKcal)}<span class="stat-unit">kcal</span></div>
            <div class="stat-sub">Goal: ${fmt(data.goalMaxCalories)} kcal</div>
          </div>
        </td>
        <td style="width:33%;padding:0 3px;vertical-align:top;">
          <div style="${CARD}">
            <div class="stat-label">Days on target</div>
            <div class="stat-value">${adherence.daysOnTarget}<span class="stat-unit">/ ${adherence.loggedDays}</span></div>
            <div class="stat-sub">${pct(adherence.loggedDays / 7)} adherence</div>
          </div>
        </td>
        <td style="width:33%;padding-left:6px;vertical-align:top;">
          <div style="${CARD}">
            <div class="stat-label">${targetDeltaTitle}</div>
            <div class="stat-value">${targetDeltaLabel}<span class="stat-unit">kcal</span></div>
            <div class="stat-sub">${targetDeltaSubLabel} &middot; ${targetDeltaKgLabel}</div>
          </div>
        </td>
      </tr>
    </table>
    <div style="font-size:12px;color:#8ea0b3;line-height:1.65;">
      ${driftNote}<br>
      ${projectionNote}
      ${
        adherence.biggestOverLabel && adherence.biggestOverDelta !== null
          ? `<br>Biggest over-target day: ${adherence.biggestOverLabel} (+${fmt(adherence.biggestOverDelta)} kcal).`
          : ''
      }
    </div>
  </div>`;
}

function buildBarChart(data: BuildWeeklyReportHtmlData): string {
  const BAR_SCALE = 4500;
  const goalLinePct = ((data.goalMaxCalories / BAR_SCALE) * 100).toFixed(1);

  const DAY_TD = `font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;color:#4b5a6b;white-space:nowrap;width:30px;padding-right:10px;padding-bottom:8px;vertical-align:middle;`;
  const KCAL_TD = `font-family:'IBM Plex Mono','Courier New',monospace;font-size:11px;color:#4b5a6b;text-align:right;white-space:nowrap;width:50px;padding-right:10px;padding-bottom:8px;vertical-align:middle;`;
  const DELTA_TD_BASE = `font-family:'IBM Plex Mono','Courier New',monospace;font-size:10px;text-align:right;white-space:nowrap;width:50px;padding-bottom:8px;vertical-align:middle;`;
  const TRACK = `height:22px;background:#111820;border-radius:3px;position:relative;overflow:visible;`;

  const bars = data.days
    .map(day => {
      const dayLabel = getWeekDayLabel(day.date);
      if (!day.hasData) {
        return `
    <tr>
      <td style="${DAY_TD}">${dayLabel}</td>
      <td style="padding-right:10px;padding-bottom:8px;vertical-align:middle;">
        <div style="${TRACK}">
          <div style="position:absolute;top:-4px;bottom:-4px;width:1px;background:#2e4a62;left:${goalLinePct}%;"></div>
        </div>
      </td>
      <td style="${KCAL_TD}">&mdash;</td>
      <td style="${DELTA_TD_BASE}color:#4b5a6b;">&mdash;</td>
    </tr>`;
      }

      const delta = day.kcal - data.goalMaxCalories;
      const widthPct = Math.min((day.kcal / BAR_SCALE) * 100, 100).toFixed(1);
      const deltaStr = signedKcal(delta);

      return `
    <tr>
      <td style="${DAY_TD}">${dayLabel}</td>
      <td style="padding-right:10px;padding-bottom:8px;vertical-align:middle;">
        <div style="${TRACK}">
          <div style="width:${widthPct}%;height:22px;background:${barColor(delta)};border-radius:3px;"></div>
          <div style="position:absolute;top:-4px;bottom:-4px;width:1px;background:#2e4a62;left:${goalLinePct}%;"></div>
        </div>
      </td>
      <td style="${KCAL_TD}">${fmt(day.kcal)}</td>
      <td style="${DELTA_TD_BASE}color:${deltaColorHex(delta)};">${deltaStr}</td>
    </tr>`;
    })
    .join('');

  return `
  <div class="section-label">Daily calories</div>
  <div class="chart-block">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td style="font-size:12px;color:#4b5a6b;">Goal: ${fmt(data.goalMaxCalories)} kcal/day</td>
        <td style="text-align:right;font-size:11px;color:#2e4a62;">&verbar;&nbsp;=&nbsp;goal</td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${bars}
    </table>
  </div>`;
}

function buildMacros(data: BuildWeeklyReportHtmlData): string {
  const daysWithData = data.days.filter(d => d.hasData);
  if (daysWithData.length < 3) {
    return `
  <div class="section-label">Average macro split</div>
  <div class="chart-block" style="padding:14px 16px;">
    <div style="font-size:12px;color:#4b5a6b;">Not enough logged days for a reliable macro pattern yet. Log at least 3 days to unlock this section.</div>
  </div>`;
  }

  const count = daysWithData.length || 1;
  const avgKcal = daysWithData.reduce((s, d) => s + d.kcal, 0) / count || 1;
  const avgCarbs = Math.round(daysWithData.reduce((s, d) => s + d.carbs, 0) / count);
  const avgProtein = Math.round(daysWithData.reduce((s, d) => s + d.protein, 0) / count);
  const avgFat = Math.round(daysWithData.reduce((s, d) => s + d.fat, 0) / count);

  const carbsPct = Math.round(((avgCarbs * 4) / avgKcal) * 100);
  const proteinPct = Math.round(((avgProtein * 4) / avgKcal) * 100);
  const fatPct = Math.round(((avgFat * 9) / avgKcal) * 100);

  const CARD = 'background:#0d1219;border:1px solid #1a2230;border-radius:8px;padding:14px 16px;';

  return `
  <div class="section-label">Average macro split</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr>
      <td style="padding-right:5px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="macro-name"><span class="macro-dot" style="background:#d4924a;"></span>Carbs</div>
          <div class="macro-g">${avgCarbs}<span style="font-size:13px;color:#4b5a6b;"> g</span></div>
          <div class="macro-pct">${carbsPct}% of calories</div>
          <div style="height:3px;background:#111820;border-radius:2px;margin-top:10px;"><div style="width:${carbsPct}%;height:3px;background:#d4924a;border-radius:2px;"></div></div>
        </div>
      </td>
      <td style="padding:0 3px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="macro-name"><span class="macro-dot" style="background:#4a7fa5;"></span>Protein</div>
          <div class="macro-g">${avgProtein}<span style="font-size:13px;color:#4b5a6b;"> g</span></div>
          <div class="macro-pct">${proteinPct}% of calories</div>
          <div style="height:3px;background:#111820;border-radius:2px;margin-top:10px;"><div style="width:${proteinPct}%;height:3px;background:#4a7fa5;border-radius:2px;"></div></div>
        </div>
      </td>
      <td style="padding-left:5px;vertical-align:top;width:33%;">
        <div style="${CARD}">
          <div class="macro-name"><span class="macro-dot" style="background:#c05a6e;"></span>Fat</div>
          <div class="macro-g">${avgFat}<span style="font-size:13px;color:#4b5a6b;"> g</span></div>
          <div class="macro-pct">${fatPct}% of calories</div>
          <div style="height:3px;background:#111820;border-radius:2px;margin-top:10px;"><div style="width:${fatPct}%;height:3px;background:#c05a6e;border-radius:2px;"></div></div>
        </div>
      </td>
    </tr>
  </table>`;
}

function buildWeightSparkline(data: BuildWeeklyReportHtmlData): string {
  const points = data.weightPoints;
  const { weekStartWeight, projectedEndWeight, actualEndWeight, projectionDelta } = getWeekWeightSummary(data);

  const projectionTagHtml =
    projectionDelta !== null
      ? `<span class="weight-delta-tag" style="background:${projectionDelta <= 0 ? '#0e2a1f' : '#2a1010'}; color:${projectionDelta <= 0 ? '#3db87a' : '#e05a5a'}; border:1px solid ${projectionDelta <= 0 ? '#1a4a33' : '#4a1a1a'};">
          ${projectionDelta <= 0 ? MINUS : '+'}${Math.abs(projectionDelta).toFixed(2)} kg vs projection
        </span>`
      : '';

  const headerHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="vertical-align:top;padding-right:8px;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">Week start</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:18px;color:#e4eaf2;">${weekStartWeight !== null ? fmtWeight(weekStartWeight) : '—'} kg</div>
        </td>
        <td style="text-align:right;vertical-align:top;padding-left:8px;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">Projected end-of-week</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:18px;color:#e4eaf2;">${projectedEndWeight !== null ? fmtWeight(projectedEndWeight) : '—'} kg</div>
        </td>
      </tr>
      <tr>
        <td style="vertical-align:top;padding-right:8px;padding-top:10px;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">Actual end-of-week</div>
          <div class="weight-main">${actualEndWeight !== null ? fmtWeight(actualEndWeight) : '—'} <span style="font-size:16px;color:#4b5a6b;font-weight:400;">kg</span></div>
          ${projectionTagHtml}
        </td>
        <td style="text-align:right;vertical-align:top;padding-left:8px;padding-top:10px;">
          <div style="font-size:11px;color:#4b5a6b;margin-top:20px;">Weekly target: ${MINUS}${fmtWeight(data.goalWeeklyRateKg)} kg</div>
        </td>
      </tr>
    </table>`;

  // Weight chart (only if ≥ 2 measurements)
  let chartHtml: string;
  if (points.length < 2) {
    chartHtml = `<p style="font-size:12px; color:#4b5a6b;">No weight measurements logged this week.</p>`;
  } else {
    chartHtml = buildWeightChartImg(data);
  }

  return `
  <div class="section-label">Weight progress</div>
  <div class="weight-block">
    ${headerHtml}
    ${chartHtml}
  </div>`;
}

function buildWeightChartImg(data: BuildWeeklyReportHtmlData): string {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const { dayValues, weekStartWeight } = getWeekWeightSummary(data);

  const lastDataIndex = dayValues.reduce<number>((last, v, i) => (v !== null ? i : last), -1);

  // Projected line: Monday weight → Sunday projected weight (span over all 7 days)
  const projectedData: (number | null)[] = new Array(7).fill(null);
  if (weekStartWeight !== null) {
    projectedData[0] = weekStartWeight;
    projectedData[6] = parseFloat((weekStartWeight - data.goalWeeklyRateKg).toFixed(2));
  }

  const chartConfig = {
    type: 'line',
    data: {
      labels: dayLabels,
      datasets: [
        {
          label: '',
          data: dayValues,
          borderColor: '#4a7fa5',
          backgroundColor: 'rgba(74,127,165,0.15)',
          pointBackgroundColor: '#4a7fa5',
          pointRadius: dayValues.map((v, i) => (v === null ? 0 : i === lastDataIndex ? 4 : 3)),
          fill: true,
          tension: 0.3,
          spanGaps: false,
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
          ticks: { color: '#4b5a6b', font: { size: 8 } },
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
  return `<img src="${chartUrl}" width="520" style="width:100%;display:block;" alt="Weight chart" />`;
}

function buildMeasurements(data: BuildWeeklyReportHtmlData): string {
  const m = data.latestMeasurements;
  const fmtVal = (v: number | null | undefined, decimals = 1) => (v != null ? v.toFixed(decimals) : '—');

  const ROW_STYLE =
    'background:#0d1219;border:1px solid #1a2230;border-radius:6px;padding:10px 14px;margin-bottom:8px;';
  const NAME_STYLE = 'font-size:12px;color:#4b5a6b;display:block;margin-bottom:2px;white-space:nowrap;';
  const VAL_STYLE = "font-family:'IBM Plex Mono','Courier New',monospace;font-size:14px;color:#e4eaf2;";

  function measureCell(label: string, value: string, side: 'left' | 'right' = 'left') {
    const pad = side === 'left' ? 'padding-right:4px;' : 'padding-left:4px;';
    return `<td style="${pad}padding-bottom:8px;vertical-align:top;width:50%;">
        <div style="${ROW_STYLE}">
          <span style="${NAME_STYLE}">${label}</span>
          <span style="${VAL_STYLE}">${value}</span>
        </div>
      </td>`;
  }

  return `
  <div class="section-label">Body measurements (week-end snapshot)</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;table-layout:fixed;">
    <tr>
      ${measureCell('Body fat', `${fmtVal(m[MeasurementTypes.BodyFat])}<span style="font-size:11px;color:#4b5a6b;"> %</span>`)}
      ${measureCell('Waist', `${fmtVal(m[MeasurementTypes.Waist], 0)}<span style="font-size:11px;color:#4b5a6b;"> cm</span>`, 'right')}
    </tr>
    <tr>
      ${measureCell('Chest', `${fmtVal(m[MeasurementTypes.Chest], 0)}<span style="font-size:11px;color:#4b5a6b;"> cm</span>`)}
      ${measureCell('Neck', `${fmtVal(m[MeasurementTypes.Neck], 0)}<span style="font-size:11px;color:#4b5a6b;"> cm</span>`, 'right')}
    </tr>
    <tr>
      ${measureCell('Weight (week end)', `${fmtVal(m[MeasurementTypes.Weight])}<span style="font-size:11px;color:#4b5a6b;"> kg</span>`)}
      <td style="padding-left:4px;padding-bottom:8px;vertical-align:top;width:50%;">
        <div style="${ROW_STYLE}">
          <span style="${NAME_STYLE}">Snapshot date</span>
          <span style="${VAL_STYLE}font-size:12px;color:#4b5a6b;">Up to ${data.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
        </div>
      </td>
    </tr>
  </table>`;
}

function buildOutlook(data: BuildWeeklyReportHtmlData): string {
  const weekEndWeight =
    data.weightPoints.length > 0
      ? data.weightPoints.slice().sort((a, b) => a.date.localeCompare(b.date))[data.weightPoints.length - 1]!.value
      : data.latestMeasurements[MeasurementTypes.Weight];
  const projectedWeight = weekEndWeight != null ? weekEndWeight - data.goalWeeklyRateKg : null;
  const dailyDeficit = data.tdee - data.goalMaxCalories;
  const deficitColor = dailyDeficit >= 0 ? '#3db87a' : '#e05a5a';
  const deficitStr = dailyDeficit >= 0 ? `${MINUS}${fmt(dailyDeficit)}` : `+${fmt(Math.abs(dailyDeficit))}`;
  // Active = TDEE - BMR
  const activeKcal = data.tdee - data.bmr;

  return `
  <div class="section-label">Next week outlook</div>
  <div class="chart-block" style="margin-bottom:28px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;padding-right:8px;padding-bottom:16px;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">TDEE</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:16px;color:#e4eaf2;">${fmt(data.tdee)} <span style="font-size:11px;color:#4b5a6b;">kcal/day</span></div>
        </td>
        <td style="width:50%;padding-bottom:16px;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">Target intake</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:16px;color:#e4eaf2;">${fmt(data.goalMaxCalories)} <span style="font-size:11px;color:#4b5a6b;">kcal/day</span></div>
        </td>
      </tr>
      <tr>
        <td style="width:50%;padding-right:8px;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">Daily deficit</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:16px;color:${deficitColor};">${deficitStr} <span style="font-size:11px;">kcal</span></div>
        </td>
        <td style="width:50%;vertical-align:top;">
          <div style="font-size:11px;color:#4b5a6b;margin-bottom:4px;">Projected weight</div>
          <div style="font-family:'IBM Plex Mono','Courier New',monospace;font-size:16px;color:#e4eaf2;">${projectedWeight != null ? fmtWeight(projectedWeight) : '—'} <span style="font-size:11px;color:#4b5a6b;">kg</span></div>
          <div style="font-size:11px;color:#4b5a6b;margin-top:4px;">From week end: ${weekEndWeight != null ? fmtWeight(weekEndWeight) : '—'} kg</div>
        </td>
      </tr>
    </table>
    <div style="margin-top:14px; padding-top:14px; border-top:1px solid #1a2230; font-size:12px; color:#4b5a6b; line-height:1.7;">
      BMR ${fmt(data.bmr)} kcal &middot; Active ${fmt(activeKcal)} kcal &middot; Goal rate ${MINUS}${fmtWeight(data.goalWeeklyRateKg)} kg/week
    </div>
  </div>`;
}

function buildFooter(data: BuildWeeklyReportHtmlData): string {
  if (!data.urls) return '';
  return `
  <div class="footer">
    hub.alexiuc.dev &middot; calories module<br>
    Week ${data.weekNumber}, ${data.year} &middot; Auto-generated<br>
    <a href="${data.urls.unsubscribeUrl}">Unsubscribe</a> &middot; <a href="${data.urls.viewInAppUrl}">View in app</a>
  </div>`;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function buildWeeklyReportHtml(data: BuildWeeklyReportHtmlData): string {
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
${buildCoachingSummary(data)}
${buildBarChart(data)}
${buildWeightSparkline(data)}
${buildOutlook(data)}
${buildMeasurements(data)}
${buildMacros(data)}
${data.urls ? buildFooter(data) : ''}
</div>
</body>
</html>`;
}
