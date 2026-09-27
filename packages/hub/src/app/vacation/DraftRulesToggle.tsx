'use client';

import { useEffect, useState } from 'react';
import type { VacationConfig } from '@my-hub/shared/services';
import type { VacationRuleSet } from '@my-hub/shared/types';
import { Checkbox } from '@/components';
import { apiFetch } from '@/lib/utils';
import { LEAVE_UNIT_SHORT_LABELS } from './constants';

type DraftRulesToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/**
 * Toggle for previewing draft (proposed-law) rule sets, with what each draft is and from when it
 * would apply. Renders nothing when no draft rule set exists.
 */
export function DraftRulesToggle({ checked, onChange }: DraftRulesToggleProps) {
  const [drafts, setDrafts] = useState<VacationRuleSet[]>([]);

  useEffect(() => {
    apiFetch<VacationConfig>('/api/vacation/config', { silentToast: true })
      .then(config => setDrafts(config.ruleSets.filter(r => r.status === 'draft')))
      .catch(() => setDrafts([]));
  }, []);

  if (drafts.length === 0) return null;

  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
        <Checkbox checked={checked} onChange={e => onChange(e.target.checked)} />
        Preview draft rules ({drafts.map(d => d.name).join(', ')})
      </label>
      {checked && (
        <ul className="space-y-0.5 pl-6 text-[11px] text-[var(--subtle)]">
          {drafts.map(d => (
            <li key={d.id}>
              Proposed law, not in force. Applies only from {d.validFrom}
              {d.validTo && ` to ${d.validTo}`}: {d.annualEntitlementDays} days a year,{' '}
              {LEAVE_UNIT_SHORT_LABELS[d.leaveUnit]}. Earlier dates are unchanged; balance saved up before then is spent
              first under the old rules.
              {d.notes && ` Note: ${d.notes}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
