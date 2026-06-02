import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

const baseProps = {
  title: 'Delete item',
  message: 'Are you sure you want to delete?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmModal', () => {
  it('renders the title and message', () => {
    render(<ConfirmModal {...baseProps} />);
    expect(screen.getAllByText('Delete item').length).toBeGreaterThan(0);
    expect(screen.getByText('Are you sure you want to delete?')).toBeTruthy();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...baseProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders a custom confirm label', () => {
    render(<ConfirmModal {...baseProps} confirmLabel="Remove forever" />);
    expect(screen.getByRole('button', { name: /remove forever/i })).toBeTruthy();
  });
});
