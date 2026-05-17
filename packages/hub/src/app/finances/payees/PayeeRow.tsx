import Link from 'next/link';
import { Button, Pill } from '@/components';
import type { PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import type { PayeeReportItem } from '@/app/api/finances/payees/report/route';
import { CategoryIcon, Divider, fmt, SectionLabel } from '../ui';
import { dateToString } from '@my-hub/shared/utils';

type PayeeRowProps = {
  payee: PayeeWithSuggestion;
  reportItem: PayeeReportItem | undefined;
  currency: string;
  showDivider: boolean;
  onEdit: (payee: PayeeWithSuggestion) => void;
  onMerge: (payee: PayeeWithSuggestion) => void;
};

function PayeeChips({ aliases, description }: { aliases: string[]; description: string | null }) {
  return (
    <>
      {aliases.length > 0 && (
        <Pill
          color="var(--fin-subtle)"
          label={aliases.length === 1 ? `Alias: ${aliases[0]}` : `Aliases: ${aliases.length}`}
          title={aliases.join(', ')}
          className="max-w-[220px] truncate text-[10px]"
        />
      )}
      {description && (
        <Pill
          color="var(--fin-subtle)"
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

export function PayeeRow({ payee, reportItem, currency, showDivider, onEdit, onMerge }: PayeeRowProps) {
  const aliases = payee.aliases ?? [];
  const description = payee.description?.trim() || null;
  const categoryColor = reportItem?.categoryColor ?? 'var(--fin-muted)';
  const lastInRange = reportItem?.lastDate ? dateToString(new Date(reportItem.lastDate)) : null;
  const lastOverall = payee.lastUsedAt ? dateToString(new Date(payee.lastUsedAt)) : null;

  return (
    <div>
      {showDivider && <Divider />}

      <div data-layout="desktop" className="hidden grid-cols-[1fr_80px_90px] items-center px-[14px] py-[10px] md:grid">
        <div className="flex items-center gap-2.5">
          <CategoryIcon color={categoryColor} icon={reportItem?.categoryIcon} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={`/finances/payees/${payee.id}`}>
                <SectionLabel className="!mb-0 !text-[13px] !font-medium !normal-case !tracking-normal !text-[var(--fin-accent)] p-0 hover:underline">
                  {payee.name}
                </SectionLabel>
              </Link>
              <PayeeChips aliases={aliases} description={description} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--fin-subtle)]">
              {reportItem?.categoryName && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  {reportItem.categoryName}
                </SectionLabel>
              )}
              {lastInRange && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  Last: {lastInRange}
                </SectionLabel>
              )}
              {payee.useCount > 0 && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  Used {payee.useCount} time{payee.useCount === 1 ? '' : 's'}
                </SectionLabel>
              )}
              {lastOverall && lastOverall !== lastInRange && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  All-time last: {lastOverall}
                </SectionLabel>
              )}
              <Button
                type="button"
                size="xs"
                variant="transparent"
                className="px-0 py-0 text-[var(--fin-accent)] hover:underline"
                onClick={() => onEdit(payee)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="xs"
                variant="transparent"
                className="flex items-center gap-1 px-0 py-0 text-[var(--fin-muted)] hover:text-[var(--fin-accent)]"
                onClick={() => onMerge(payee)}
                title="Merge into this payee"
              >
                <MergeIcon />
              </Button>
            </div>
          </div>
        </div>

        <div className="text-right text-xs tabular-nums text-[var(--fin-muted)]">
          {reportItem ? reportItem.txCount : '—'}
        </div>
        <div className="text-right text-[13px] font-semibold tabular-nums text-[var(--fin-text)]">
          {reportItem ? fmt(reportItem.totalSpent, currency) : '—'}
        </div>
      </div>

      <div data-layout="mobile" className="px-4 py-3 md:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <CategoryIcon color={categoryColor} icon={reportItem?.categoryIcon} size="md" />
            <div className="min-w-0">
              <Link
                href={`/finances/payees/${payee.id}`}
                className="truncate text-[13px] font-semibold text-[var(--fin-accent)] hover:underline"
              >
                {payee.name}
              </Link>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <PayeeChips aliases={aliases} description={description} />
              </div>
            </div>
          </div>

          <div className="text-right">
            {reportItem ? (
              <>
                <div className="text-[13px] font-semibold tabular-nums text-[var(--fin-text)]">
                  {fmt(reportItem.totalSpent, currency)}
                </div>
                <div className="text-[11px] tabular-nums text-[var(--fin-muted)]">{reportItem.txCount} txns</div>
              </>
            ) : (
              <div className="text-[11px] text-[var(--fin-subtle)]">No data</div>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--fin-subtle)]">
          {reportItem?.categoryName && (
            <Pill color="var(--fin-subtle)" label={reportItem.categoryName} className="text-[10px]" />
          )}
          {lastInRange && <Pill color="var(--fin-subtle)" label={`Last: ${lastInRange}`} className="text-[10px]" />}
          {payee.useCount > 0 && (
            <Pill
              color="var(--fin-subtle)"
              label={`Used ${payee.useCount} time${payee.useCount === 1 ? '' : 's'}`}
              className="text-[10px]"
            />
          )}
          {lastOverall && lastOverall !== lastInRange && (
            <Pill color="var(--fin-subtle)" label={`All-time: ${lastOverall}`} className="text-[10px]" />
          )}
          <Button
            type="button"
            size="xs"
            variant="transparent"
            className="px-0 py-0 text-[var(--fin-accent)] hover:underline"
            onClick={() => onEdit(payee)}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="xs"
            variant="transparent"
            className="flex items-center gap-1 px-0 py-0 text-[var(--fin-muted)] hover:text-[var(--fin-accent)]"
            onClick={() => onMerge(payee)}
            title="Merge into this payee"
          >
            <MergeIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
