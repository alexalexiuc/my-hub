'use client';

import { useMemo, useState } from 'react';
import { Modal, Button, Select } from '@/components';
import { ClipboardIcon } from '@/components/icons';
import { DaysOfWeekValues, DAY_LABELS } from '@my-hub/shared/constants';
import type { DayOfWeek, GymTime } from '@my-hub/shared/constants';
import { formatMenuAsText, formatDayAsText } from './menu.utils';
import type { WeeklyMenu } from './types';

type ShareMenuModalProps = {
  menu: WeeklyMenu;
  gymDays: number[];
  gymTime: GymTime | null;
  onClose: () => void;
};

/** Scope value for the "whole week" option in the day picker — day values are `DayOfWeek` numbers. */
const WHOLE_WEEK = 'week';

/**
 * Share panel for a weekly menu. Copy-to-clipboard (plain text) is the only sharing method for
 * now — the aim is a household sharing a menu without cooking two different sets of meals, so
 * the text lists each meal's exact ingredients and amounts (not just a macro summary) plus the
 * macro breakdown, spelled out so it's unambiguous if pasted back into an AI model to plan for
 * two. A day picker lets the whole week be copied, or just one day. In-app sharing with another
 * Hub user is a planned follow-up, not implemented here.
 */
export function ShareMenuModal({ menu, gymDays, gymTime, onClose }: ShareMenuModalProps) {
  const daysWithMeals = useMemo(
    () => DaysOfWeekValues.filter(d => menu.meals.some(m => m.dayOfWeek === d)),
    [menu.meals],
  );
  const [scope, setScope] = useState<string>(WHOLE_WEEK);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => {
    if (scope === WHOLE_WEEK) return formatMenuAsText(menu, gymDays, gymTime);
    return formatDayAsText(menu, Number(scope) as DayOfWeek, gymDays, gymTime);
  }, [scope, menu, gymDays, gymTime]);

  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Modal title="Share Weekly Menu" onClose={onClose} className="md:max-w-md">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-[var(--muted)]">
          Copy the exact meals — ingredients, amounts and macros, not just an overview — so someone in your house can
          see exactly what to prepare, or paste it to an AI model along with theirs to plan a combined menu for two.
        </p>

        {daysWithMeals.length > 1 && (
          <Select value={scope} onChange={e => setScope(e.target.value)} aria-label="What to copy">
            <option value={WHOLE_WEEK}>Whole week</option>
            {daysWithMeals.map(d => (
              <option key={d} value={d}>
                {DAY_LABELS[d]} only
              </option>
            ))}
          </Select>
        )}

        <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--card2)] p-3 text-xs text-[var(--text)]">
          {text}
        </pre>

        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={copy}
          className="inline-flex items-center justify-center gap-1.5"
        >
          <ClipboardIcon className="size-3.5" />
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>

        <p className="text-[10px] text-[var(--subtle)] text-center border-t border-[var(--border)] pt-3">
          More ways to share — directly with someone in the app — are coming soon.
        </p>
      </div>
    </Modal>
  );
}
