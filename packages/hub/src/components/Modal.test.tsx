import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders the title and children', () => {
    render(
      <Modal title="My Modal" onClose={vi.fn()}>
        <p>Modal body</p>
      </Modal>,
    );
    expect(screen.getAllByText('My Modal').length).toBeGreaterThan(0);
    expect(screen.getByText('Modal body')).toBeTruthy();
  });

  it('locks body scroll while mounted and restores on unmount', () => {
    const { unmount } = render(
      <Modal title="Test" onClose={vi.fn()}>
        body
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('calls onClose when the desktop backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Test" onClose={onClose}>
        body
      </Modal>,
    );
    const backdrop = container.querySelector('[data-layout="desktop"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a submit footer when onSubmit is provided', () => {
    render(
      <Modal title="Test" onClose={vi.fn()} onSubmit={vi.fn()} submitLabel="Publish">
        body
      </Modal>,
    );
    expect(screen.getAllByText('Publish').length).toBeGreaterThan(0);
  });

  it('calls onSubmit when the submit button is clicked', () => {
    const onSubmit = vi.fn();
    render(
      <Modal title="Test" onClose={vi.fn()} onSubmit={onSubmit} submitLabel="Save">
        body
      </Modal>,
    );
    fireEvent.click(screen.getAllByText('Save')[0]!);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
