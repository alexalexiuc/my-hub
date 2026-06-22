import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Collapsible } from './Collapsible';

describe('Collapsible', () => {
  it('renders children when open by default', () => {
    render(
      <Collapsible label="Section">
        <p>Body content</p>
      </Collapsible>,
    );
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('hides children when defaultOpen is false', () => {
    render(
      <Collapsible label="Section" defaultOpen={false}>
        <p>Body content</p>
      </Collapsible>,
    );
    expect(screen.queryByText('Body content')).toBeNull();
  });

  it('toggles open state when the icon button is clicked', () => {
    render(
      <Collapsible label="Section" defaultOpen={false}>
        <p>Body content</p>
      </Collapsible>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(screen.getByText('Body content')).toBeTruthy();
  });

  it('toggles open state when the label is clicked', () => {
    render(
      <Collapsible label="Section" defaultOpen={true}>
        <p>Body content</p>
      </Collapsible>,
    );
    fireEvent.click(screen.getByText('Section'));
    expect(screen.queryByText('Body content')).toBeNull();
  });

  it('supports controlled open state via open/onOpenChange', () => {
    const onOpenChange = vi.fn();
    render(
      <Collapsible label="Section" open={false} onOpenChange={onOpenChange}>
        <p>Body content</p>
      </Collapsible>,
    );
    expect(screen.queryByText('Body content')).toBeNull();
    fireEvent.click(screen.getByText('Section'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Body content')).toBeNull();
  });

  it('sets aria-expanded on the toggle button to reflect open state', () => {
    render(
      <Collapsible label="Section" defaultOpen={true}>
        <p>Body content</p>
      </Collapsible>,
    );
    expect(screen.getByRole('button', { name: 'Collapse' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('renders leading, inlineActions, and actions slots', () => {
    render(
      <Collapsible
        label="Section"
        leading={<span>Leading</span>}
        inlineActions={<span>InlineActions</span>}
        actions={<span>Actions</span>}
      >
        <p>Body content</p>
      </Collapsible>,
    );
    expect(screen.getByText('Leading')).toBeTruthy();
    expect(screen.getByText('InlineActions')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });
});
