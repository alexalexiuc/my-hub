import type { VacationTaxRegime } from '@my-hub/shared/types';
import { SectionLabel } from '@/components';
import { cn } from '@/lib/utils';
import { TAX_REGIME_LABELS } from '../constants';
import { coversDate, formatRate } from '../vacation.utils';

type TaxRegimesSectionProps = {
  taxRegimes: VacationTaxRegime[];
  /** The profile's employer, marked as current. */
  employer: string | null;
  today: string;
};

/** Every employer's tax regime on a dated timeline, with the withholding rates each applies. */
export function TaxRegimesSection({ taxRegimes, employer, today }: TaxRegimesSectionProps) {
  const isCurrent = (e: string) => employer !== null && e.trim().toLowerCase() === employer.trim().toLowerCase();

  return (
    <section>
      <SectionLabel>Employers &amp; tax</SectionLabel>
      {taxRegimes.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">None yet.</p>
      ) : (
        <ol className="space-y-2">
          {taxRegimes.map(t => {
            const inForce = coversDate(t, today) && isCurrent(t.employer);
            return (
              <li
                key={t.id}
                className={cn(
                  'space-y-1 rounded-md border border-[var(--border)] p-3 text-sm',
                  inForce && 'border-[var(--accent)]',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{t.employer}</span>
                  <span className="flex gap-1 text-[11px]">
                    {inForce && (
                      <span className="rounded-full bg-[var(--accent)] px-2 py-px text-[var(--on-accent)]">
                        In force today
                      </span>
                    )}
                    <span className="rounded-full border border-[var(--border)] px-2 py-px text-[var(--muted)]">
                      {TAX_REGIME_LABELS[t.regime]}
                    </span>
                  </span>
                </div>
                <p className="text-xs font-medium">
                  {t.validFrom} → {t.validTo ?? 'no end date'}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {t.medicalRate === 0 && t.incomeTaxRate === 0
                    ? 'Nothing withheld from you: net pay equals gross.'
                    : `Withheld: medical ${formatRate(t.medicalRate)}, income tax ${formatRate(t.incomeTaxRate)}.`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
