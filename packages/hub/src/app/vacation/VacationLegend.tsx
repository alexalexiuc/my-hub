/** Key for the vacation grid's leave outlines, holiday dot and gain/loss fills. */
export function VacationLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm outline outline-2 outline-offset-1 outline-[var(--violet)]" />
        Taken
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm outline-dashed outline-2 outline-offset-1 outline-[var(--blue)]" />
        Planned
      </li>
      <li className="flex items-center gap-1.5">
        <span className="text-[var(--amber)]">●</span>
        Public holiday
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-[var(--green)]" />
        Gain vs working
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-[var(--red)]" />
        Loss vs working
      </li>
    </ul>
  );
}
