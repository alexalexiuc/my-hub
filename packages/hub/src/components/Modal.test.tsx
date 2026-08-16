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
    // `baseElement`, not `container`: the modal is portaled to document.body, so it is not a
    // descendant of the render container.
    const { baseElement } = render(
      <Modal title="Test" onClose={onClose}>
        body
      </Modal>,
    );
    const backdrop = baseElement.querySelector('[data-layout="desktop"]') as HTMLElement;
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

  /**
   * The portal is what keeps a modal readable when whatever opened it is faded or transformed —
   * CSS `opacity` applies to a whole subtree and a child cannot opt out, so a dialog rendered
   * inside the weekly menu's dimmed future-day card came out half-transparent.
   */
  it('renders outside the tree that opened it, into document.body', () => {
    const { container, baseElement } = render(
      <div className="opacity-50">
        <Modal title="Portaled" onClose={vi.fn()}>
          body
        </Modal>
      </div>,
    );

    expect(container.querySelector('.modal-shell')).toBeNull();
    const shell = baseElement.querySelector('.modal-shell');
    expect(shell).not.toBeNull();
    expect(shell!.closest('.opacity-50')).toBeNull();
  });

  it('calls onClose when the browser back button is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal title="Test" onClose={onClose}>
        body
      </Modal>,
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('discards its pushed history entry when closed without a back-press', () => {
    const historyBackSpy = vi
      .spyOn(window.history, 'back')
      .mockImplementation(() => window.dispatchEvent(new PopStateEvent('popstate')));
    const { unmount } = render(
      <Modal title="Test" onClose={vi.fn()}>
        body
      </Modal>,
    );
    unmount();
    expect(historyBackSpy).toHaveBeenCalledOnce();
    historyBackSpy.mockRestore();
  });
});
