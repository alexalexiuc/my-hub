import type { ReactNode } from 'react';

export function IconButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
