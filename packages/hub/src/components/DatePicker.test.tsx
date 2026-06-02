import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePicker } from './DatePicker';

vi.mock('@my-hub/shared/utils', () => ({
  shiftMonthStr: vi.fn((m: string, delta: number) => (delta < 0 ? 'prev-month' : 'next-month')),
  formatMonthStr: vi.fn((m: string) => m),
}));

describe('DatePicker', () => {
  it('renders the current month label', () => {
    render(<DatePicker month="2026-06" onChange={vi.fn()} />);
    // Use heading role to target the h2 specifically (container div also matches getByText)
    expect(screen.getByRole('heading', { name: '2026-06' })).toBeTruthy();
  });

  it('calls onChange with the previous month when the back arrow is clicked', () => {
    const onChange = vi.fn();
    render(<DatePicker month="2026-06" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(onChange).toHaveBeenCalledWith({ month: 'prev-month' });
  });

  it('calls onChange with the next month when the forward arrow is clicked', () => {
    const onChange = vi.fn();
    render(<DatePicker month="2026-06" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(onChange).toHaveBeenCalledWith({ month: 'next-month' });
  });

  it('disables the next-month arrow when month reaches maxMonth', () => {
    render(<DatePicker month="2026-06" onChange={vi.fn()} maxMonth="2026-06" />);
    const nextBtn = screen.getByLabelText('Next month') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it('shows a Today pill when the displayed month differs from currentMonth', () => {
    render(<DatePicker month="2026-03" onChange={vi.fn()} currentMonth="2026-06" />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('does not show a Today pill when displayed month matches currentMonth', () => {
    render(<DatePicker month="2026-06" onChange={vi.fn()} currentMonth="2026-06" />);
    expect(screen.queryByText('Today')).toBeNull();
  });
});
