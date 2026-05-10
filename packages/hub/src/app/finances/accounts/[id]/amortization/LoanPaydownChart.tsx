import type { ScheduleRow } from '@/app/api/finances/contracts';
import { fmt } from '../../../ui';

type LoanPaydownChartProps = {
  rows: ScheduleRow[];
  principal: number;
  currency: string;
  width?: number;
  height?: number;
};

export function LoanPaydownChart({ rows, principal, currency, width = 320, height = 110 }: LoanPaydownChartProps) {
  if (!rows.length || principal <= 0) return null;

  const padTop = 14;
  const padBottom = 18;
  const padLeft = 8;
  const padRight = 8;
  const chartH = height - padTop - padBottom;
  const chartW = width - padLeft - padRight;
  const N = rows.length;

  // points[0] = (0, principal); points[i+1] = (i+1, rows[i].balance)
  const toX = (i: number) => padLeft + (i / N) * chartW;
  const toY = (balance: number) => padTop + chartH - (balance / principal) * chartH;

  const pts: [number, number][] = [[0, principal], ...rows.map((r, i) => [i + 1, r.balance] as [number, number])];

  const polylinePoints = pts.map(([i, b]) => `${toX(i)},${toY(b)}`).join(' ');

  const areaPath =
    `M ${pts.map(([i, b]) => `${toX(i)},${toY(b)}`).join(' L ')}` +
    ` L ${toX(N)},${padTop + chartH} L ${toX(0)},${padTop + chartH} Z`;

  const currentRowIdx = rows.findIndex(r => r.current);
  const currentIdx = currentRowIdx >= 0 ? currentRowIdx + 1 : rows.filter(r => r.paid).length;
  const currentX = toX(currentIdx);

  const paidClipId = 'lpc-paid';
  const remainingClipId = 'lpc-remaining';

  return (
    <svg
      width={width}
      height={height}
      className="block w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <clipPath id={paidClipId}>
          <rect x={0} y={0} width={currentX} height={height} />
        </clipPath>
        <clipPath id={remainingClipId}>
          <rect x={currentX} y={0} width={width - currentX} height={height} />
        </clipPath>
      </defs>

      {/* Paid region — green */}
      <path d={areaPath} fill="var(--fin-green)" fillOpacity={0.22} clipPath={`url(#${paidClipId})`} />
      {/* Remaining region — red */}
      <path d={areaPath} fill="var(--fin-red)" fillOpacity={0.12} clipPath={`url(#${remainingClipId})`} />

      {/* Balance curve */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--fin-muted)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.6}
      />

      {/* Current position marker */}
      {currentIdx > 0 && currentIdx < N && (
        <line
          x1={currentX}
          y1={padTop}
          x2={currentX}
          y2={padTop + chartH}
          stroke="var(--fin-accent)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          strokeOpacity={0.8}
        />
      )}

      {/* X-axis labels */}
      <text x={toX(0)} y={height - 2} fontSize={9} fill="var(--fin-subtle)" textAnchor="start">
        1
      </text>
      {currentIdx > 1 && currentIdx < N - 1 && (
        <text x={currentX} y={height - 2} fontSize={9} fill="var(--fin-accent)" textAnchor="middle">
          {currentIdx}
        </text>
      )}
      <text x={toX(N)} y={height - 2} fontSize={9} fill="var(--fin-subtle)" textAnchor="end">
        {N}
      </text>

      {/* Y-axis labels */}
      <text x={padLeft} y={padTop + chartH} fontSize={9} fill="var(--fin-subtle)" dominantBaseline="ideographic">
        0
      </text>
      <text x={padLeft} y={padTop + 9} fontSize={9} fill="var(--fin-subtle)" dominantBaseline="ideographic">
        {fmt(principal, currency)}
      </text>
    </svg>
  );
}
