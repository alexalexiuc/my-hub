import Link from 'next/link';
import { IconButton, Pill, SwipeRow } from '@/components';
import { PencilIcon } from '@/components/icons';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { PayeeReportItem } from '@/app/api/finances/payees/report/route';
import { CategoryIcon, Divider, fmt, SectionLabel, SubText } from '../ui';
import { dateToString } from '@my-hub/shared/utils';

type PayeeRowProps = {
  payee: PayeeWithSuggestion;
  reportItem: PayeeReportItem | undefined;
  currency: string;
  showDivider: boolean;
  isSwipeOpen: boolean;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onEdit: (payee: PayeeWithSuggestion) => void;
  onMerge: (payee: PayeeWithSuggestion) => void;
};

function PayeeChips({ aliases, description }: { aliases: string[]; description: string | null }) {
  return (
    <>
      {aliases.length > 0 && (
        <Pill
          color="var(--subtle)"
          label={aliases.length === 1 ? `Alias: ${aliases[0]}` : `Aliases: ${aliases.length}`}
          title={aliases.join(', ')}
          className="max-w-[220px] truncate text-[10px]"
        />
      )}
      {description && (
        <Pill
          color="var(--subtle)"
          label={`Description: ${description}`}
          title={description}
          className="max-w-[260px] truncate text-[10px]"
        />
      )}
    </>
  );
}

function MergeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 2h3l2 3-2 3H2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M12 2h-3l-2 3 2 3h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 5v5m0 0-1.5-1.5M7 10l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PayeeRow({
  payee,
  reportItem,
  currency,
  showDivider,
  isSwipeOpen,
  onSwipeOpen,
  onSwipeClose,
  onEdit,
  onMerge,
}: PayeeRowProps) {
  const aliases = payee.aliases ?? [];
  const description = payee.description?.trim() || null;
  const categoryColor = reportItem?.categoryColor ?? 'var(--muted)';
  const lastInRange = reportItem?.lastDate ? dateToString(new Date(reportItem.lastDate)) : null;
  const lastOverall = payee.lastUsedAt ? dateToString(new Date(payee.lastUsedAt)) : null;

  return (
    <div>
      {showDivider && <Divider />}

      {/* Desktop: hover to reveal actions */}
      <div
        data-layout="desktop"
        className="group relative hidden grid-cols-[1fr_80px_90px] items-center px-[14px] py-[10px] md:grid"
      >
        <div className="flex items-center gap-2.5">
          <CategoryIcon color={categoryColor} icon={reportItem?.categoryIcon} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/finances/payees/${payee.id}`}>
                <SectionLabel className="!mb-0 !text-[13px] !font-medium !normal-case !tracking-normal !text-[var(--accent)] p-0 hover:underline">
                  {payee.name}
                </SectionLabel>
              </Link>
              <PayeeChips aliases={aliases} description={description} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--subtle)]">
              {reportItem?.categoryName && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--subtle)] p-0">
                  {reportItem.categoryName}
                </SectionLabel>
              )}
              {lastInRange && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--subtle)] p-0">
                  Last: {lastInRange}
                </SectionLabel>
              )}
              {payee.useCount > 0 && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--subtle)] p-0">
                  Used {payee.useCount} time{payee.useCount === 1 ? '' : 's'}
                </SectionLabel>
              )}
              {lastOverall && lastOverall !== lastInRange && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--subtle)] p-0">
                  All-time last: {lastOverall}
                </SectionLabel>
              )}
            </div>
          </div>
        </div>

        <div className="text-right text-xs tabular-nums text-[var(--muted)]">
          {reportItem ? reportItem.txCount : '—'}
        </div>
        <div className="text-right text-[13px] font-semibold tabular-nums text-[var(--text)]">
          {reportItem ? fmt(reportItem.totalSpent, currency) : '—'}
        </div>

        <div className="pointer-events-none absolute inset-y-0 right-[14px] flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-1 shadow-sm">
            <IconButton
              label="Edit"
              icon={<PencilIcon className="size-3.5" />}
              onClick={() => onEdit(payee)}
              className="bg-transparent p-1 text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--text)]"
            />
            <span className="h-3 w-px bg-[var(--border)]" />
            <IconButton
              label="Merge into this payee"
              icon={<MergeIcon />}
              onClick={() => onMerge(payee)}
              className="bg-transparent p-1 text-[var(--muted)] hover:bg-[var(--card2)] hover:text-[var(--text)]"
            />
          </div>
        </div>
      </div>

      {/* Mobile: swipe to reveal edit + merge */}
      <div data-layout="mobile" className="md:hidden">
        <SwipeRow
          isOpen={isSwipeOpen}
          onOpen={onSwipeOpen}
          onClose={onSwipeClose}
          onEdit={() => onEdit(payee)}
          secondAction={{ icon: <MergeIcon />, onClick: () => onMerge(payee) }}
        >
          <div className="bg-[var(--card)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <CategoryIcon color={categoryColor} icon={reportItem?.categoryIcon} size="md" />
                <div className="min-w-0">
                  <Link
                    href={`/finances/payees/${payee.id}`}
                    className="block truncate text-[13px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {payee.name}
                  </Link>
                  {lastInRange && <SubText className="block">{lastInRange}</SubText>}
                </div>
              </div>

              <div className="shrink-0 text-right">
                {reportItem ? (
                  <>
                    <div className="text-[13px] font-semibold tabular-nums text-[var(--text)]">
                      {fmt(reportItem.totalSpent, currency)}
                    </div>
                    <SubText className="tabular-nums">{reportItem.txCount} txns</SubText>
                  </>
                ) : (
                  <SubText className="block">No data</SubText>
                )}
              </div>
            </div>
          </div>
        </SwipeRow>
      </div>
    </div>
  );
}
