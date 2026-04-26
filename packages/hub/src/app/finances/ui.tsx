'use client';

import { categoryIconEmoji } from './categoryIcons';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const T = {
  bg: '#0e0e12',
  shell: '#111116',
  card: '#18181e',
  card2: '#21212a',
  card3: '#2a2a35',
  border: '#35354a',
  text: '#f2f2f8',
  muted: '#9898b0',
  subtle: '#606078',
  accent: '#a78bfa',
  accentD: 'rgba(167,139,250,.12)',
  green: '#6ee7b7',
  greenD: 'rgba(110,231,183,.10)',
  blue: '#93c5fd',
  blueD: 'rgba(147,197,253,.10)',
  amber: '#fcd34d',
  amberD: 'rgba(252,211,77,.10)',
  red: '#f87171',
  redD: 'rgba(248,113,113,.10)',
  violet: '#a78bfa',
  violetD: 'rgba(167,139,250,.12)',
  teal: '#2dd4bf',
  tealD: 'rgba(45,212,191,.10)',
} as const;

// ─── Currency formatter ───────────────────────────────────────────────────────
export function fmt(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(value));
}

export function fmtSign(value: number, currency = 'EUR') {
  return (value < 0 ? '-' : '+') + fmt(value, currency);
}

// ─── Primitive components ─────────────────────────────────────────────────────

export function Card({
  children,
  style,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .15s',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.1em',
        color: T.subtle,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({ icon, label, color }: { icon?: string; label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 20,
        background: color + '22',
        border: `1px solid ${color}44`,
        fontSize: 11,
        fontWeight: 500,
        color,
      }}
    >
      {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
      {label}
    </span>
  );
}

export function Bar({
  value,
  max,
  color,
  height = 6,
  style,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  style?: React.CSSProperties;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const barColor = pct >= 100 ? T.red : pct >= 80 ? T.amber : (color ?? T.green);
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        background: T.card2,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: height / 2,
          background: barColor,
          transition: 'width .4s ease',
        }}
      />
    </div>
  );
}

export function AmountText({
  value,
  size = 'md',
  currency = 'EUR',
  sign = false,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  currency?: string;
  sign?: boolean;
}) {
  const isNeg = value < 0;
  const color = sign ? (isNeg ? T.red : T.green) : T.text;
  const sizes = { sm: 14, md: 18, lg: 28, xl: 36 };
  return (
    <span
      style={{
        fontWeight: 600,
        fontSize: sizes[size],
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {sign ? (isNeg ? '-' : '+') : ''}
      {fmt(value, currency)}
    </span>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: T.border, margin: '2px 0' }} />;
}

export function Sparkline({
  data,
  color,
  width = 120,
  height = 36,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `M ${pts.split(' ').join(' L ')} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="finances-sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#finances-sg)" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Category icon in a colored square ───────────────────────────────────────

const CATEGORY_ICON_SIZES = {
  sm: { box: 26, radius: 7, font: 12 },
  md: { box: 30, radius: 8, font: 13 },
  lg: { box: 32, radius: 9, font: 15 },
} as const;

type CategoryIconProps = {
  color: string | null;
  icon?: string | null;
  size?: keyof typeof CATEGORY_ICON_SIZES;
  fallback?: string;
  children?: React.ReactNode;
};

export function CategoryIcon({ color, icon, size = 'md', fallback, children }: CategoryIconProps) {
  const c = color ?? T.muted;
  const { box, radius, font } = CATEGORY_ICON_SIZES[size];
  return (
    <div
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        flexShrink: 0,
        background: c + '20',
        border: `1px solid ${c}2a`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: font,
      }}
    >
      {children ?? (fallback && !icon ? fallback : categoryIconEmoji(icon))}
    </div>
  );
}

// ─── Account type metadata ────────────────────────────────────────────────────
export const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  bank: { label: 'Bank', color: '#93c5fd', icon: '🏦' },
  investment: { label: 'Investment', color: '#6ee7b7', icon: '📈' },
  credit_card: { label: 'Credit Card', color: '#f87171', icon: '💳' },
  loan: { label: 'Loan', color: '#f87171', icon: '🏷' },
  goal: { label: 'Goal', color: '#a78bfa', icon: '🎯' },
  cash: { label: 'Cash', color: '#fcd34d', icon: '💵' },
  tracking: { label: 'Tracking', color: '#9898b0', icon: '👁' },
  borrowed_lent: { label: 'Borrowed/Lent', color: '#2dd4bf', icon: '🤝' },
};

// ─── Cashflow bar chart (SVG) ─────────────────────────────────────────────────
export function CashflowChart({
  data,
  width = 320,
  height = 100,
}: {
  data: { month: string; income: number; expense: number }[];
  width?: number;
  height?: number;
}) {
  if (!data.length) return <div style={{ width, height }} />;
  const max = Math.max(...data.flatMap(d => [d.income, d.expense]), 1);
  const cols = data.length;
  const colW = width / cols;
  const bw = Math.max(8, Math.floor(colW * 0.3));
  const gap = 2;

  return (
    <svg width={width} height={height + 20} style={{ display: 'block', overflow: 'visible' }}>
      {data.map((d, i) => {
        const x = i * colW + (colW - bw * 2 - gap) / 2;
        const iH = Math.max(2, (d.income / max) * height);
        const eH = Math.max(2, (d.expense / max) * height);
        return (
          <g key={i}>
            <rect x={x} y={height - iH} width={bw} height={iH} fill={T.green} fillOpacity={0.7} rx={3} />
            <rect x={x + bw + gap} y={height - eH} width={bw} height={eH} fill={T.red} fillOpacity={0.7} rx={3} />
            <text x={x + bw} y={height + 14} textAnchor="middle" fontSize={9} fill={T.subtle}>
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
