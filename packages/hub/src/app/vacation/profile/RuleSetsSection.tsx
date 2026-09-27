import type { VacationRuleSet } from '@my-hub/shared/types';
import { SectionLabel } from '@/components';
import { cn } from '@/lib/utils';
import { LEAVE_UNIT_LABELS, RATE_BASIS_LABELS, RULE_SET_STATUS_LABELS } from '../constants';
import { coversDate } from '../vacation.utils';

type RuleSetsSectionProps = {
  ruleSets: VacationRuleSet[];
  today: string;
};

/**
 * Every labour-law rule set as a dated timeline entry: what it counts, how pay is averaged, when it
 * applies. A rule set only ever applies inside its own dates; a draft only when previewed.
 */
export function RuleSetsSection({ ruleSets, today }: RuleSetsSectionProps) {
  return (
    <section>
      <SectionLabel>Leave rules</SectionLabel>
      {ruleSets.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">None yet.</p>
      ) : (
        <ol className="space-y-2">
          {ruleSets.map(r => {
            const inForce = r.status === 'active' && coversDate(r, today);
            return (
              <li
                key={r.id}
                data-rule-set-id={r.id}
                className={cn(
                  'space-y-1 rounded-md border border-[var(--border)] p-3 text-sm',
                  r.status === 'draft' && 'border-dashed',
                  inForce && 'border-[var(--accent)]',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.name}</span>
                  <span className="flex gap-1 text-[11px]">
                    {inForce && (
                      <span className="rounded-full bg-[var(--accent)] px-2 py-px text-[var(--on-accent)]">
                        In force today
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-full border px-2 py-px',
                        r.status === 'draft'
                          ? 'border-dashed border-[var(--amber)] text-[var(--amber)]'
                          : 'border-[var(--border)] text-[var(--muted)]',
                      )}
                    >
                      {RULE_SET_STATUS_LABELS[r.status]}
                    </span>
                  </span>
                </div>
                <p className="text-xs font-medium">
                  {r.validFrom} → {r.validTo ?? 'no end date'}
                  {r.region && ` · ${r.region} only`}
                </p>
                <ul className="space-y-0.5 text-xs text-[var(--muted)]">
                  <li>
                    {r.annualEntitlementDays} days a year · {LEAVE_UNIT_LABELS[r.leaveUnit]}
                  </li>
                  <li>
                    Pay: {RATE_BASIS_LABELS[r.rateBasis]}, over the {r.avgWindowMonths} months before the leave
                    {r.raiseResetsWindow && '; a raise restarts the window'}
                  </li>
                  {r.status === 'draft' && (
                    <li className="text-[var(--amber)]">
                      A proposed law, not in force. It is used only with “Preview draft rules” on the calendar, and only
                      from {r.validFrom}.
                    </li>
                  )}
                  {r.notes && <li className="italic">{r.notes}</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
