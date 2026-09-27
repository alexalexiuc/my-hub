import type { VacationConfig } from '@my-hub/shared/services';
import { dateToString } from '@my-hub/shared/utils';
import { Card, SectionLabel } from '@/components';
import { formatMdl } from '../vacation.utils';
import { RuleSetsSection } from './RuleSetsSection';
import { TaxRegimesSection } from './TaxRegimesSection';

type SetupSummaryProps = {
  config: VacationConfig;
};

/**
 * Read-only view of everything the calculations use besides the profile form: leave-law rule sets
 * and employer tax regimes on a dated timeline, salary and holiday coverage, and what is missing.
 */
export function SetupSummary({ config }: SetupSummaryProps) {
  const { profile, ruleSets, taxRegimes, holidayCoverage, salaryCoverage, warnings } = config;
  const today = dateToString(new Date());

  return (
    <Card compact className="space-y-5">
      <RuleSetsSection ruleSets={ruleSets} today={today} />
      <TaxRegimesSection taxRegimes={taxRegimes} employer={profile?.employer ?? null} today={today} />

      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <section>
          <SectionLabel>Salaries</SectionLabel>
          {salaryCoverage.firstMonth ? (
            <ul className="space-y-0.5 text-xs text-[var(--muted)]">
              <li>
                Recorded {salaryCoverage.firstMonth} → {salaryCoverage.lastMonth}
              </li>
              <li>Latest actual: {salaryCoverage.lastActualMonth ?? 'none'}</li>
              {salaryCoverage.missingMonths.length > 0 && (
                <li className={profile?.baseSalaryMdl != null ? '' : 'text-[var(--amber)]'}>
                  Gaps{profile?.baseSalaryMdl != null ? ' (base salary used)' : ''}:{' '}
                  {salaryCoverage.missingMonths.join(', ')}
                </li>
              )}
              <li>
                Later months:{' '}
                {profile?.baseSalaryMdl != null
                  ? `base salary ${formatMdl(profile.baseSalaryMdl)} gross`
                  : 'latest payment repeated (set a base salary above)'}
              </li>
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">None yet — add them under Payments.</p>
          )}
        </section>
        <section>
          <SectionLabel>Public holidays</SectionLabel>
          {holidayCoverage.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">None yet.</p>
          ) : (
            <ul className="space-y-0.5 text-xs text-[var(--muted)]">
              {holidayCoverage.map(h => (
                <li key={h.year}>
                  {h.year}: {h.holidays} holidays{h.transfers > 0 && `, ${h.transfers} transferred days`}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-1 text-xs text-[var(--subtle)]">
        <p>
          Leave rules, tax regimes and holidays come from labour-law research. Ask Claude to change them through the
          Vacation MCP (vacation_setup). Each one applies only between its own dates.
        </p>
        <p>
          Changing employer: update Employer above, and ask Claude to end the old employer’s tax regime the day before
          you start and add the new one from your first day. Past months keep the old employer’s regime.
        </p>
      </div>

      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-[var(--amber)]">
          {warnings.map(w => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
