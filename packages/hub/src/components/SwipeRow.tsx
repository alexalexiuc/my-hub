'use client';

import { useRef, useEffect } from 'react';
import { PencilIcon, TrashIcon } from './icons';

const ACTION_WIDTH = 128; // 2 × 64px buttons

type SwipeRowProps = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
};

export function SwipeRow({ isOpen, onOpen, onClose, onEdit, onDelete, children }: SwipeRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const hasActions = onEdit || onDelete;

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.transition = 'transform 0.2s ease';
    contentRef.current.style.transform = isOpen ? `translateX(${-ACTION_WIDTH}px)` : 'translateX(0)';
  }, [isOpen]);

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0]!.clientX;
    if (contentRef.current) contentRef.current.style.transition = 'none';
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!contentRef.current) return;
    const dx = e.touches[0]!.clientX - startXRef.current;
    const base = isOpen ? -ACTION_WIDTH : 0;
    const clamped = Math.min(0, Math.max(-ACTION_WIDTH, base + dx));
    contentRef.current.style.transform = `translateX(${clamped}px)`;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!contentRef.current) return;
    const dx = e.changedTouches[0]!.clientX - startXRef.current;
    contentRef.current.style.transition = 'transform 0.2s ease';
    if (!isOpen && dx < -40) {
      onOpen();
    } else if (isOpen && dx > 30) {
      onClose();
    } else {
      contentRef.current.style.transform = isOpen ? `translateX(${-ACTION_WIDTH}px)` : 'translateX(0)';
    }
  }

  if (!hasActions) return <>{children}</>;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex gap-px bg-[var(--fin-border)]" style={{ width: ACTION_WIDTH }}>
        {onEdit && (
          <button
            className="flex flex-1 items-center justify-center bg-[var(--fin-card2)] text-[var(--fin-blue)]"
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
            className="flex flex-1 items-center justify-center bg-[var(--fin-card2)] text-[var(--fin-red)]"
            onClick={() => {
              onClose();
              onDelete();
            }}
          >
            <TrashIcon className="size-5" />
          </button>
        )}
      </div>
      <div
        ref={contentRef}
        className="bg-[var(--fin-card)]"
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
