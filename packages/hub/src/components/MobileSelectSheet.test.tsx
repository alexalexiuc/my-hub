import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileSelectSheet } from './MobileSelectSheet';
import type { DropdownOption } from './searchableSelect.utils';

const options: DropdownOption[] = [
  { id: 'apple', value: 'Apple' },
  { id: 'banana', value: 'Banana' },
  { id: 'cherry', value: 'Cherry' },
];

describe('MobileSelectSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all options', () => {
    render(<MobileSelectSheet options={options} onChange={vi.fn()} onClose={vi.fn()} />);
    // Use getAllByText since the option Button and its inner span both have the same textContent
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Banana').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cherry').length).toBeGreaterThan(0);
  });

  it('calls onChange with the selected option', () => {
    const onChange = vi.fn();
    render(<MobileSelectSheet options={options} onChange={onChange} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith(options[1]);
  });

  it('calls onClose after selecting an option', () => {
    const onClose = vi.fn();
    render(<MobileSelectSheet options={options} onChange={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apple' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('displays the title when provided', () => {
    render(<MobileSelectSheet options={options} onChange={vi.fn()} onClose={vi.fn()} title="Pick a fruit" />);
    expect(screen.getByText('Pick a fruit')).toBeTruthy();
  });

  it('shows no-results message when search matches nothing', () => {
    render(<MobileSelectSheet options={options} onChange={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyz' } });
    expect(screen.getByText('No options found')).toBeTruthy();
  });
});
