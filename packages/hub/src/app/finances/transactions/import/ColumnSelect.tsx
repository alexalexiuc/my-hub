'use client';

export type ColumnSelectProps = {
  label: string;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function ColumnSelect({
  label,
  value,
  headers,
  onChange,
  placeholder = '— skip —',
  required,
}: ColumnSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-[var(--subtle)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--red)]">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-[8px] border border-[var(--border)] bg-[var(--card2)] px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {headers.map(h => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}
