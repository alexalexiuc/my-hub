import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiSelect } from './MultiSelect';

const options = [
  { id: 'food', value: 'Food' },
  { id: 'transport', value: 'Transport' },
  { id: 'health', value: 'Health' },
];

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

describe('MultiSelect', () => {
  it('renders selected values as pills', () => {
    render(<MultiSelect options={options} value={['food', 'health']} onChange={vi.fn()} />);
    // Pill renders label as text
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Health').length).toBeGreaterThan(0);
  });

  it('does not render any pill remove buttons when no values are selected', () => {
    render(<MultiSelect options={options} value={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^remove /i })).toBeNull();
  });

  it('calls onChange without the removed value when a pill remove is clicked', () => {
    const onChange = vi.fn();
    render(<MultiSelect options={options} value={['food', 'health']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Food' }));
    expect(onChange).toHaveBeenCalledWith(['health']);
  });

  it('excludes already-selected options from the dropdown', () => {
    render(<MultiSelect options={options} value={['food']} onChange={vi.fn()} placeholder="Items" />);
    // Placeholder changes to "Add another items..." when there is a selection
    fireEvent.focus(screen.getByPlaceholderText('Add another items...'));
    expect(screen.queryByRole('button', { name: 'Food' })).toBeNull();
    expect(screen.getAllByText('Transport').length).toBeGreaterThan(0);
  });
});
