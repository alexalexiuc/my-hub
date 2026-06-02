'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { categoryIconEmoji } from './categoryIcons';
import { Button } from '@/components';
import { PlusOutlineIcon } from '@/components/icons/PlusOutlineIcon';
import type { DropdownOption } from './financialDropdown.utils';

// ─── Currency formatter ───────────────────────────────────────────────────────
export function fmt(value: number, currency = 'EUR', reverseSign = false) {
  const finalValue = reverseSign ? -value : value;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(finalValue);
}

export function fmtSign(value: number, currency = 'EUR') {
  return (value < 0 ? '-' : '+') + fmt(value, currency);
}

// ─── Primitive components ─────────────────────────────────────────────────────

export function FinFieldCard({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2.5', className)}>
      <span className="mb-[3px] block text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">{label}</span>
      {children}
    </label>
  );
}

export { Card } from '@/components';

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--subtle)]', className)}>
      {children}
    </div>
  );
}

type SubTextProps = React.HTMLAttributes<HTMLSpanElement>;
export function SubText({ children, className, ...rest }: SubTextProps) {
  return (
    <span className={cn('text-[11px] text-[var(--subtle)]', className)} {...rest}>
      {children}
    </span>
  );
}

export function Bar({
  value,
  max,
  color,
  height = 6,
  className,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const barColor = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : (color ?? 'var(--green)');
  return (
    <div
      className={cn('overflow-hidden', className)}
      style={{ height, borderRadius: height / 2, background: 'var(--card2)' }}
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
  const sizeClass = { sm: 'text-[14px]', md: 'text-[18px]', lg: 'text-[28px]', xl: 'text-[36px]' } as const;
  const colorClass = sign ? (isNeg ? 'text-[var(--red)]' : 'text-[var(--green)]') : 'text-[var(--text)]';
  return (
    <span className={cn('font-semibold tabular-nums', sizeClass[size], colorClass)}>
      {sign ? (isNeg ? '-' : '+') : ''}
      {fmt(value, currency)}
    </span>
  );
}

export function Divider() {
  return <div className="my-[2px] h-px bg-[var(--border)]" />;
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
  const gradientId = useId();
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
    <svg width={width} height={height} className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
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
  const c = color ?? 'var(--muted)';
  const { box, radius, font } = CATEGORY_ICON_SIZES[size];
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: box,
        height: box,
        borderRadius: radius,
        background: c + '20',
        border: `1px solid ${c}2a`,
        fontSize: font,
      }}
    >
      {children ?? (fallback && !icon ? fallback : categoryIconEmoji(icon))}
    </div>
  );
}

// ─── Account type metadata ────────────────────────────────────────────────────
export const TYPE_META: Record<string, { label: string; color: string; icon: string }> = {
  bank: { label: 'Bank', color: 'var(--blue)', icon: '🏦' },
  investment: { label: 'Investment', color: 'var(--green)', icon: '📈' },
  credit_card: { label: 'Credit Card', color: 'var(--red)', icon: '💳' },
  loan: { label: 'Loan', color: 'var(--red)', icon: '🏷' },
  goal: { label: 'Goal', color: 'var(--violet)', icon: '🎯' },
  cash: { label: 'Cash', color: 'var(--amber)', icon: '💵' },
  tracking: { label: 'Tracking', color: 'var(--muted)', icon: '👁' },
  borrowed_lent: { label: 'Borrowed/Lent', color: 'var(--teal)', icon: '🤝' },
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
    <svg width={width} height={height + 20} className="block overflow-visible">
      {data.map((d, i) => {
        const x = i * colW + (colW - bw * 2 - gap) / 2;
        const iH = Math.max(2, (d.income / max) * height);
        const eH = Math.max(2, (d.expense / max) * height);
        return (
          <g key={i}>
            <rect x={x} y={height - iH} width={bw} height={iH} fill="var(--green)" fillOpacity={0.7} rx={3} />
            <rect x={x + bw + gap} y={height - eH} width={bw} height={eH} fill="var(--red)" fillOpacity={0.7} rx={3} />
            <text x={x + bw} y={height + 14} textAnchor="middle" fontSize={9} fill="var(--subtle)">
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

type AddButtonProps = {
  onClick: () => void;
  title: string;
};

export function AddButton({ onClick, title }: AddButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[20px] font-semibold bg-[var(--accent-d)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--card)]"
    >
      <PlusOutlineIcon className="size-3" />
      {title}
    </Button>
  );
}

// ─── Dropdown option renderers ───────────────────────────────────────────────

export function renderAccountOption(
  item: DropdownOption,
  accounts: { id: number; type: string; currency: string; archived?: boolean }[],
) {
  const acc = accounts.find(a => String(a.id) === String(item.id));
  const meta = acc ? (TYPE_META[acc.type] ?? null) : null;
  return (
    <span className="flex w-full items-center gap-2">
      {meta && (
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px]"
          style={{ background: meta.color + '28' }}
        >
          {meta.icon}
        </span>
      )}
      <span className={cn('flex-1 truncate', acc?.archived && 'text-[var(--subtle)]')}>{String(item.value)}</span>
      {acc?.archived && (
        <span className="shrink-0 rounded bg-[var(--card3)] px-1 text-[9px] uppercase tracking-wide text-[var(--subtle)]">
          archived
        </span>
      )}
      {acc && <SubText className="ml-auto shrink-0">{acc.currency}</SubText>}
    </span>
  );
}

export function renderCategoryOption(
  item: DropdownOption,
  categories: { id: number; icon: string | null; color: string | null }[],
) {
  const cat = categories.find(c => String(c.id) === String(item.id));
  return (
    <span className="flex w-full items-center gap-2">
      {cat && <CategoryIcon color={cat.color} icon={cat.icon} size="sm" />}
      <span className="flex-1 truncate">{String(item.value)}</span>
    </span>
  );
}

// ─── SmartDatePicker (replaces MonthCarousel) ────────────────────────────────
export { SmartDatePicker } from './SmartDatePicker';
export type { DateMode } from './SmartDatePicker';

export function SeeAllButton({ href }: { href: string }) {
  return (
    <Button variant="ghost" href={href} size="xs" className="text-[var(--accent)]">
      See all →
    </Button>
  );
}
