'use client';

import { useMemo, useState } from 'react';
import { Modal, Button } from '@/components';
import { ClipboardIcon } from '@/components/icons';
import type { GymTime } from '@my-hub/shared/constants';
import { formatMenuAsText } from './menu.utils';
import type { WeeklyMenu } from './types';

type ShareMenuModalProps = {
  menu: WeeklyMenu;
  gymDays: number[];
  gymTime: GymTime | null;
  onClose: () => void;
};

/**
 * Share panel for a weekly menu. Copy-to-clipboard (plain text, macros included) is the only
 * sharing method for now — the aim is a household sharing a menu without cooking two different
 * sets of meals, and a macro breakdown a person or an AI model can read back to plan for two.
 * In-app sharing with another Hub user is a planned follow-up, not implemented here.
 */
export function ShareMenuModal({ menu, gymDays, gymTime, onClose }: ShareMenuModalProps) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => formatMenuAsText(menu, gymDays, gymTime), [menu, gymDays, gymTime]);

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
          Copy this week&apos;s plan as text — share it with someone in your house so you&apos;re not cooking two
          different meals, or paste it to an AI model along with theirs to plan a combined menu for two.
        </p>

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
