import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayTotalsCard } from './DayTotalsCard';

const TOTALS = { kcal: 1200, protein: 80, carbs: 120, fat: 40 };
const RANGE = { target: 2000, min: 1600, isGymDay: false, gymDayBonus: 0 };

describe('DayTotalsCard', () => {
  it("shows the day's kcal against its range", () => {
    render(<DayTotalsCard totals={TOTALS} mealsError={null} range={RANGE} rangeFailed={false} goalProtein={null} />);
    expect(screen.getByText('Aim for 1,600–2,000')).toBeTruthy();
  });

  it('shows no totals while the meals load, and says so when they failed, instead of 0 kcal', () => {
    const { rerender } = render(
      <DayTotalsCard totals={null} mealsError={null} range={RANGE} rangeFailed={false} goalProtein={null} />,
    );
    expect(screen.getByText("Loading the day's totals…")).toBeTruthy();
    expect(screen.queryByText('kcal')).toBeNull();

    rerender(<DayTotalsCard totals={null} mealsError="offline" range={RANGE} rangeFailed={false} goalProtein={null} />);
    expect(screen.getByText("Couldn't load this day's totals")).toBeTruthy();
  });

  it('says "No goal set" only when the range has arrived and is empty', () => {
    const { rerender } = render(
      <DayTotalsCard totals={TOTALS} mealsError={null} range={null} rangeFailed={false} goalProtein={null} />,
    );
    expect(screen.queryByText(/No goal set/)).toBeNull();

    rerender(<DayTotalsCard totals={TOTALS} mealsError={null} range={null} rangeFailed goalProtein={null} />);
    expect(screen.getByText("Couldn't load this day's goal")).toBeTruthy();
    expect(screen.queryByText(/No goal set/)).toBeNull();

    rerender(
      <DayTotalsCard
        totals={TOTALS}
        mealsError={null}
        range={{ ...RANGE, target: null, min: null }}
        rangeFailed={false}
        goalProtein={null}
      />,
    );
    expect(screen.getByText(/No goal set/)).toBeTruthy();
  });
});
