'use client';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  width?: string | number;
}

export function MultiButtonGroup<T extends string>({ options, value, onChange, width }: Props<T>) {
  const activeIndex = options.findIndex((o) => o.value === value);
  const n = options.length;

  return (
    <div className="relative flex rounded-full border border-zinc-700 bg-zinc-800 p-0.5" style={{ width }}>
      <div
        className="absolute rounded-full bg-zinc-600 transition-all duration-200 ease-in-out"
        style={{
          top: '2px',
          bottom: '2px',
          width: `calc((100% - 4px) / ${n})`,
          left: `calc(2px + ${activeIndex} * (100% - 4px) / ${n})`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative z-10 flex-1 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200 ${
            option.value === value ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
