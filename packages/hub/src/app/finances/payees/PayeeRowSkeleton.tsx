import { Divider } from '@/components';

type PayeeRowSkeletonProps = {
  showDivider: boolean;
};

export function PayeeRowSkeleton({ showDivider }: PayeeRowSkeletonProps) {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {showDivider && <Divider />}

      {/* Desktop */}
      <div data-layout="desktop" className="hidden grid-cols-[1fr_80px_90px] items-center px-[14px] py-[10px] md:grid">
        <div className="flex items-center gap-2.5">
          <div className="size-[32px] shrink-0 rounded-[9px] bg-[var(--card2)]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-32 rounded bg-[var(--card2)]" />
            <div className="h-2.5 w-20 rounded bg-[var(--card2)]" />
          </div>
        </div>
        <div className="flex justify-end">
          <div className="h-3 w-6 rounded bg-[var(--card2)]" />
        </div>
        <div className="flex justify-end">
          <div className="h-3 w-12 rounded bg-[var(--card2)]" />
        </div>
      </div>

      {/* Mobile */}
      <div data-layout="mobile" className="px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="size-[30px] shrink-0 rounded-[8px] bg-[var(--card2)]" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-28 rounded bg-[var(--card2)]" />
              <div className="h-2.5 w-16 rounded bg-[var(--card2)]" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="h-3 w-14 rounded bg-[var(--card2)]" />
            <div className="h-2.5 w-10 rounded bg-[var(--card2)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
