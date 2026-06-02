'use client';

import { Modal } from './Modal';
import { Button } from '@/components/Button';

type ConfirmModalProps = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  /** Button variant for the confirm action. Default: "danger" */
  confirmVariant?: 'danger' | 'primary' | 'accent';
  /** Inline style override for the confirm button, e.g. to apply theme CSS variables. */
  confirmStyle?: React.CSSProperties;
  loading?: boolean;
};

/** Generic confirmation dialog built on Modal. */
export function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  confirmStyle,
  loading,
}: ConfirmModalProps) {
  return (
    <Modal onClose={onCancel} title={title} className="md:max-w-[360px]">
      <p className="mb-5 text-[13px] text-[var(--muted)]">{message}</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          size="sm"
          className="flex-1"
          style={confirmStyle}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
