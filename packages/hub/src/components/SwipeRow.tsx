'use client';

import { useRef, useEffect } from 'react';
import { PencilIcon, TrashIcon } from './icons';

const ACTION_WIDTH = 128; // 2 × 64px buttons
const COMPLETE_THRESHOLD = 72; // px to swipe right to trigger onComplete

type SwipeRowProps = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Custom second action rendered instead of / alongside onDelete. */
  secondAction?: { icon: React.ReactNode; onClick: () => void };
  /** Swipe-right action (e.g. mark done). Triggers at threshold; no persistent open state. */
  onComplete?: () => void;
  /** When true the swipe-right hint shows an undo icon (item is already done). */
  completeDone?: boolean;
  children: React.ReactNode;
};

export function SwipeRow({
  isOpen,
  onOpen,
  onClose,
  onEdit,
  onDelete,
  secondAction,
  onComplete,
  completeDone,
  children,
}: SwipeRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const hasActions = onEdit || onDelete || secondAction;

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.transition = 'transform 0.2s ease';
    contentRef.current.style.transform = isOpen ? `translateX(${-ACTION_WIDTH}px)` : 'translateX(0)';
  }, [isOpen]);

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0]!.clientX;
    if (contentRef.current) contentRef.current.style.transition = 'none';
  }

  function setLeftPanelOpacity(opacity: number, animated = false) {
    if (!leftPanelRef.current) return;
    leftPanelRef.current.style.transition = animated ? 'opacity 0.2s ease' : 'none';
    leftPanelRef.current.style.opacity = String(opacity);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!contentRef.current) return;
    const dx = e.touches[0]!.clientX - startXRef.current;
    if (onComplete && !isOpen && dx > 0) {
      const clamped = Math.min(COMPLETE_THRESHOLD, dx);
      contentRef.current.style.transform = `translateX(${clamped}px)`;
      setLeftPanelOpacity(clamped / COMPLETE_THRESHOLD);
      return;
    }
    const base = isOpen ? -ACTION_WIDTH : 0;
    const clamped = Math.min(0, Math.max(-ACTION_WIDTH, base + dx));
    contentRef.current.style.transform = `translateX(${clamped}px)`;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!contentRef.current) return;
    const dx = e.changedTouches[0]!.clientX - startXRef.current;
    contentRef.current.style.transition = 'transform 0.2s ease';
    if (onComplete && !isOpen && dx >= COMPLETE_THRESHOLD) {
      contentRef.current.style.transform = 'translateX(0)';
      setLeftPanelOpacity(0, true);
      onComplete();
      return;
    }
    if (onComplete && !isOpen && dx > 0) {
      contentRef.current.style.transform = 'translateX(0)';
      setLeftPanelOpacity(0, true);
      return;
    }
    if (!isOpen && dx < -40) {
      onOpen();
    } else if (isOpen && dx > 30) {
      onClose();
    } else {
      contentRef.current.style.transform = isOpen ? `translateX(${-ACTION_WIDTH}px)` : 'translateX(0)';
    }
  }

  if (!hasActions && !onComplete) return <>{children}</>;

  return (
    <div className="relative overflow-hidden">
      {/* Right panel — edit / delete (swipe left) */}
      {hasActions && (
        <div className="absolute inset-y-0 right-0 flex gap-px bg-[var(--border)]" style={{ width: ACTION_WIDTH }}>
          {onEdit && (
            <button
              className="flex flex-1 items-center justify-center bg-[var(--card2)] text-[var(--blue)]"
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              <PencilIcon className="size-5" />
            </button>
          )}
          {onDelete && (
            <button
              className="flex flex-1 items-center justify-center bg-[var(--card2)] text-[var(--red)]"
              onClick={() => {
                onClose();
                onDelete();
              }}
            >
              <TrashIcon className="size-5" />
            </button>
          )}
          {secondAction && (
            <button
              className="flex flex-1 items-center justify-center bg-[var(--card2)] text-[var(--muted)]"
              onClick={() => {
                onClose();
                secondAction.onClick();
              }}
            >
              {secondAction.icon}
            </button>
          )}
        </div>
      )}

      {/* Left panel — complete hint (swipe right); starts invisible, revealed imperatively */}
      {onComplete && (
        <div
          ref={leftPanelRef}
          className="absolute inset-y-0 left-0 flex items-center justify-center px-5"
          style={{ background: completeDone ? 'var(--amber)' : 'var(--green)', opacity: 0 }}
        >
          <span className="text-[18px] font-bold text-white">{completeDone ? '↺' : '✓'}</span>
        </div>
      )}

      <div
        ref={contentRef}
        className="bg-[var(--card)]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isOpen ? onClose : undefined}
      >
        {children}
      </div>
    </div>
  );
}
