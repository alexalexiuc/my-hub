import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeSamplePreview } from './ThemeSamplePreview';

describe('ThemeSamplePreview', () => {
  it('renders heading, body, and caption text', () => {
    render(<ThemeSamplePreview />);
    expect(screen.getByRole('heading', { name: 'Trip to Lisbon' })).toBeTruthy();
    expect(screen.getByText(/4 nights/)).toBeTruthy();
    expect(screen.getByText(/Last updated/)).toBeTruthy();
  });

  it('renders every button variant', () => {
    render(<ThemeSamplePreview />);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });

  it('renders a ghost input, a checkbox, and the status badges', () => {
    render(<ThemeSamplePreview />);
    expect(screen.getByPlaceholderText('Add a note…')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Remind me' })).toBeTruthy();
    for (const label of ['Booked', 'Flights', 'Overdue', 'Pending']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
