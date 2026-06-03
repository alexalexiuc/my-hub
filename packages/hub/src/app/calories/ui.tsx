import type React from 'react';

export function FieldCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block cursor-default rounded-[10px] border border-[var(--border)] bg-[var(--card2)] px-3 py-2.5">
      <span className="mb-[3px] block text-[9px] uppercase tracking-[0.07em] text-[var(--subtle)]">{label}</span>
      {children}
    </label>
  );
}
