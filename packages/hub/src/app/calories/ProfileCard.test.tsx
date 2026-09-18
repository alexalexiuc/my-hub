import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CalorieProfile } from '@my-hub/shared/types';
import { ProfileCard } from './ProfileCard';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn().mockResolvedValue({}) };
});

const PROFILE = {
  id: 1,
  userId: 'user-1',
  age: 36,
  sex: 'male',
  heightCm: 181.5,
  activityLevel: 'moderately_active',
  goalType: 'weight_loss',
  // The value that used to kill the form: not a multiple of the old step="0.1".
  goalWeeklyRateKg: 0.75,
  goalStartDate: '2026-07-01',
  goalStartWeightKg: 97.4,
  goalTargetWeightKg: 87.9,
  goalMinCalories: null,
  goalMaxCalories: null,
  goalProtein: null,
  goalCarbs: null,
  goalFat: null,
  gymDays: [0, 2, 4],
  gymDayCalorieBonus: 300,
  gymTime: 'evening',
  notes: null,
  automationApiKey: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-09-18T00:00:00Z'),
} as unknown as CalorieProfile;

const MEASUREMENTS = [
  { typeKey: 'weight', value: 90.25, date: '2026-09-18', typeLabel: 'Weight', typeUnit: 'kg' },
] as never;

/**
 * Each labelled field now carries an info trigger whose accessible name repeats the field name
 * ("About Goal weight (kg)"), so a loose label regex matches both it and the control. These queries
 * mean the control.
 */
const INPUT = { selector: 'input' } as const;

function renderEditing() {
  const view = render(<ProfileCard profile={PROFILE} latestMeasurements={MEASUREMENTS} onUpdated={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /edit/i }));
  return view;
}

describe('ProfileCard', () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * A number input whose stored value fails native constraint validation blocks form submission in
   * the browser *before* React's onSubmit runs — no error, no request, no clue. `step="0.1"` on the
   * weekly rate did exactly that to every profile with a rate of 0.75, which the MCP tool accepts
   * and which is a common choice. The form must be able to save back whatever the system stored.
   */
  it('accepts stored decimal values that a fixed step would reject', () => {
    renderEditing();

    const rate = screen.getByLabelText(/rate \(kg\/week\)/i, INPUT) as HTMLInputElement;
    expect(rate.value).toBe('0.75');
    expect(rate.step).toBe('any');
    expect(rate.checkValidity()).toBe(true);

    // Same class of failure on every other decimal field the rest of the system can write.
    for (const label of [/height/i, /^weight/i, /goal weight/i, /gym day bonus|bonus/i]) {
      const field = screen.queryByLabelText(label, INPUT) as HTMLInputElement | null;
      if (!field || field.type !== 'number') continue;
      expect(field.step, `${field.name} should not constrain granularity`).toBe('any');
      expect(field.checkValidity(), `${field.name} rejects its own stored value`).toBe(true);
    }
  });

  it('keeps range limits even though granularity is unconstrained', () => {
    renderEditing();

    const rate = screen.getByLabelText(/rate \(kg\/week\)/i, INPUT) as HTMLInputElement;
    expect(rate.min).toBe('0.1');
    expect(rate.max).toBe('2');
  });

  it('pre-fills the goal weight from the profile', () => {
    renderEditing();

    expect((screen.getByLabelText(/goal weight/i, INPUT) as HTMLInputElement).value).toBe('87.9');
  });

  /**
   * Goal weight's explanation used to live in its placeholder, where it was both unreadable (wider
   * than the input, gone on the first keystroke) and literally broken — the string carried an
   * unprocessed `—` escape, so the dash rendered as those six characters.
   */
  it('explains goal weight behind an info icon rather than in the placeholder', () => {
    renderEditing();

    const input = screen.getByLabelText(/goal weight/i, INPUT) as HTMLInputElement;
    expect(input.placeholder).toBe('Optional');
    expect(input.placeholder).not.toContain('\\u');

    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'About Goal weight (kg)' }));
    expect(screen.getByRole('tooltip').textContent).toMatch(/estimates a finish date/i);
  });

  it('offers no goal weight for a maintain goal, which has no finish line', () => {
    render(
      <ProfileCard
        profile={{ ...PROFILE, goalType: 'maintain' } as CalorieProfile}
        latestMeasurements={MEASUREMENTS}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.queryByLabelText(/goal weight/i, INPUT)).toBeNull();
  });
});
