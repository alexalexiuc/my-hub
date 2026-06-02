import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchableSelect } from './SearchableSelect';

const options = [
  { id: 'apple', value: 'Apple' },
  { id: 'banana', value: 'Banana' },
  { id: 'cherry', value: 'Cherry' },
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

describe('SearchableSelect', () => {
  it('renders the placeholder text', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} placeholder="Search…" />);
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy();
  });

  it('shows options after focusing the input', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} placeholder="Search…" />);
    fireEvent.focus(screen.getByRole('textbox'));
    // getAllByText since the option Button and its inner span both match
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Banana').length).toBeGreaterThan(0);
  });

  it('calls onChange with the selected option on mousedown', () => {
    const onChange = vi.fn();
    render(<SearchableSelect options={options} onChange={onChange} placeholder="Search…" />);
    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Banana' }));
    expect(onChange).toHaveBeenCalledWith(options[1]);
  });

  it('filters options based on the search query', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} placeholder="Search…" />);
    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ban' } });
    expect(screen.getAllByText('Banana').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Apple' })).toBeNull();
  });

  it('closes the dropdown on Escape key', () => {
    render(<SearchableSelect options={options} onChange={vi.fn()} placeholder="Search…" />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getAllByText('Apple').length).toBeGreaterThan(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Apple' })).toBeNull();
  });
});
