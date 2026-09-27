import type { VacationConfig } from '@my-hub/shared/services';
import { Card, SectionLabel } from '@/components';

type SetupSummaryProps = {
  config: VacationConfig;
};

/**
 * Read-only view of the parts of the setup that are researched rather than typed in — labour-law
 * rule sets, tax regimes and public holidays — plus what is still missing.
 */
export function SetupSummary({ config }: SetupSummaryProps) {
  const { ruleSets, taxRegimes, holidayCoverage, salaryCoverage, warnings } = config;

  return (
    <Card compact className="space-y-4">
      <div>
        <SectionLabel>Rule sets</SectionLabel>
        {ruleSets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {ruleSets.map(r => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {r.name} <span className="text-xs text-[var(--subtle)]">({r.status})</span>
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {r.annualEntitlementDays} {r.leaveUnit} days/yr · {r.validFrom} → {r.validTo ?? 'open'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionLabel>Tax regimes</SectionLabel>
        {taxRegimes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {taxRegimes.map(t => (
              <li key={t.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t.employer} <span className="text-xs text-[var(--subtle)]">({t.regime.replace('_', ' ')})</span>
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {t.validFrom} → {t.validTo ?? 'open'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <SectionLabel>Salaries</SectionLabel>
          <p className="text-[var(--muted)]">
            {salaryCoverage.firstMonth
              ? `${salaryCoverage.firstMonth} → ${salaryCoverage.lastMonth}`
              : 'None yet — add them under Payments.'}
          </p>
        </div>
        <div>
          <SectionLabel>Public holidays</SectionLabel>
          <p className="text-[var(--muted)]">
            {holidayCoverage.length === 0 ? 'None yet.' : holidayCoverage.map(h => h.year).join(', ')}
          </p>
        </div>
      </div>

      <p className="text-xs text-[var(--subtle)]">
        Rule sets, tax regimes and holidays come from labour law research — ask Claude to set them up through the
        Vacation MCP (vacation_setup).
      </p>

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
