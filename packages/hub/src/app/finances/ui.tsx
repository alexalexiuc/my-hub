'use client';

import { cn } from '@/lib/utils';
import { categoryIconEmoji } from './categoryIcons';
import { Button, SubText } from '@/components';
import { PlusOutlineIcon } from '@/components/icons/PlusOutlineIcon';
import type { DropdownOption } from './financialDropdown.utils';

// ─── Shared chart styles ─────────────────────────────────────────────────────
export const tooltipBoxStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--text)',
} as const;

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

export function SeeAllButton({ href }: { href: string }) {
  return (
    <Button variant="ghost" href={href} size="xs" className="text-[var(--accent)]">
      See all →
    </Button>
  );
}
