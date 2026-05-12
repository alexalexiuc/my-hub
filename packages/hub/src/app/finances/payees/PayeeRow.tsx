import { Button, Pill } from '@/components';
import type { PayeeSuggestion } from '@/app/api/finances/payees/route';
import type { PayeeReportItem } from '@/app/api/finances/payees/report/route';
import { CategoryIcon, Divider, fmt, SectionLabel } from '../ui';
import { dateToString } from '@my-hub/shared/utils';

type PayeeRowProps = {
  payee: PayeeReportItem;
  fullPayee: PayeeSuggestion | undefined;
  currency: string;
  showDivider: boolean;
  onEdit: (payee: PayeeSuggestion) => void;
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

export function PayeeRow({ payee, fullPayee, currency, showDivider, onEdit }: PayeeRowProps) {
  const aliases = fullPayee?.aliases ?? [];
  const description = fullPayee?.description?.trim() || null;
  const categoryColor = payee.categoryColor ?? 'var(--fin-muted)';
  const lastInRange = payee.lastDate ? dateToString(new Date(payee.lastDate)) : '';
  const lastOverall = fullPayee?.lastUsedAt ? dateToString(new Date(fullPayee.lastUsedAt)) : null;

  return (
    <div>
      {showDivider && <Divider />}

      <div data-layout="desktop" className="hidden grid-cols-[1fr_80px_90px] items-center px-[14px] py-[10px] md:grid">
        <div className="flex items-center gap-2.5">
          <CategoryIcon color={categoryColor} icon={payee.categoryIcon} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <SectionLabel className="!mb-0 !text-[13px] !font-medium !normal-case !tracking-normal !text-[var(--fin-text)] p-0">
                {payee.name}
              </SectionLabel>
              <PayeeChips aliases={aliases} description={description} />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[var(--fin-subtle)]">
              {payee.categoryName && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  {payee.categoryName}
                </SectionLabel>
              )}
              <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                Last: {lastInRange}
              </SectionLabel>
              {fullPayee && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  Used {fullPayee.useCount} time{fullPayee.useCount === 1 ? '' : 's'}
                </SectionLabel>
              )}
              {lastOverall && lastOverall !== lastInRange && (
                <SectionLabel className="!mb-0 !text-[10px] !font-normal !uppercase !tracking-widest !text-[var(--fin-subtle)] p-0">
                  All-time last: {lastOverall}
                </SectionLabel>
              )}
              {fullPayee && (
                <Button
                  type="button"
                  size="xs"
                  variant="transparent"
                  className="px-0 py-0 text-[var(--fin-accent)] hover:underline"
                  onClick={() => onEdit(fullPayee)}
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="text-right text-xs tabular-nums text-[var(--fin-muted)]">{payee.txCount}</div>
        <div className="text-right text-[13px] font-semibold tabular-nums text-[var(--fin-text)]">
          {fmt(payee.totalSpent, currency)}
        </div>
      </div>

      <div data-layout="mobile" className="px-4 py-3 md:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <CategoryIcon color={categoryColor} icon={payee.categoryIcon} size="md" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[var(--fin-text)]">{payee.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <PayeeChips aliases={aliases} description={description} />
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[13px] font-semibold tabular-nums text-[var(--fin-text)]">
              {fmt(payee.totalSpent, currency)}
            </div>
            <div className="text-[11px] tabular-nums text-[var(--fin-muted)]">{payee.txCount} txns</div>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--fin-subtle)]">
          {payee.categoryName && <Pill color="var(--fin-subtle)" label={payee.categoryName} className="text-[10px]" />}
          <Pill color="var(--fin-subtle)" label={`Last: ${lastInRange}`} className="text-[10px]" />
          {fullPayee && (
            <Pill
              color="var(--fin-subtle)"
              label={`Used ${fullPayee.useCount} time${fullPayee.useCount === 1 ? '' : 's'}`}
              className="text-[10px]"
            />
          )}
          {lastOverall && lastOverall !== lastInRange && (
            <Pill color="var(--fin-subtle)" label={`All-time: ${lastOverall}`} className="text-[10px]" />
          )}
          {fullPayee && (
            <Button
              type="button"
              size="xs"
              variant="transparent"
              className="px-0 py-0 text-[var(--fin-accent)] hover:underline"
              onClick={() => onEdit(fullPayee)}
            >
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
