import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YearNav } from './YearNav';

describe('YearNav', () => {
  it('renders the year and steps it with the arrows', () => {
    const onChange = vi.fn();
    render(<YearNav year={2026} onChange={onChange} />);

    expect(screen.getByText('2026')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Previous year'));
    expect(onChange).toHaveBeenLastCalledWith(2025);

    fireEvent.click(screen.getByLabelText('Next year'));
    expect(onChange).toHaveBeenLastCalledWith(2027);
  });

  it('disables the arrows at minYear/maxYear', () => {
    render(<YearNav year={2026} onChange={vi.fn()} minYear={2026} maxYear={2026} />);
    expect((screen.getByLabelText('Previous year') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Next year') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a "This year" pill only when the year differs from currentYear', () => {
    const onChange = vi.fn();
    const { rerender } = render(<YearNav year={2026} onChange={onChange} currentYear={2026} />);
    expect(screen.queryByText('This year')).toBeNull();

    rerender(<YearNav year={2024} onChange={onChange} currentYear={2026} />);
    fireEvent.click(screen.getByText('This year'));
    expect(onChange).toHaveBeenLastCalledWith(2026);
  });

  it('renders trailing content', () => {
    render(<YearNav year={2026} onChange={vi.fn()} trailing={<span>trailing-slot</span>} />);
    expect(screen.getByText('trailing-slot')).toBeTruthy();
  });
});
