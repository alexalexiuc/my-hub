'use client';

import { useState } from 'react';
import { Button } from './Button';

type CopyButtonProps = {
  value: string;
  label?: string;
};

/** Copies `value` to the clipboard on click, showing a transient "Copied!" confirmation. */
export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={copy}
      className="ml-1 px-1.5 py-0.5 text-[var(--accent)] hover:bg-[var(--accent-d)] hover:text-[var(--accent)]"
    >
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </Button>
  );
}
