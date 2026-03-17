interface Props {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export default function Field({ label, children, className = '' }: Props) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-zinc-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}
