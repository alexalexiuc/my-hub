import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IncludeExcludeChip } from './IncludeExcludeChip';

describe('IncludeExcludeChip', () => {
  it('renders "Exclude" when included is true', () => {
    render(<IncludeExcludeChip included onToggle={vi.fn()} />);
    expect(screen.getByText('Exclude')).toBeTruthy();
  });

  it('renders "Include" when included is false', () => {
    render(<IncludeExcludeChip included={false} onToggle={vi.fn()} />);
    expect(screen.getByText('Include')).toBeTruthy();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<IncludeExcludeChip included onToggle={onToggle} />);
    fireEvent.click(screen.getByText('Exclude'));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
