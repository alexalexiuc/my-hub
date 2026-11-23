import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dateToString, shiftDateStr } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import type { MealLog } from '@my-hub/shared/types';
import { setMealLogged } from './menu/menu.utils';
import { NextMealCard } from './NextMealCard';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn() };
});
vi.mock('./menu/menu.utils', async () => {
  const actual = await vi.importActual<typeof import('./menu/menu.utils')>('./menu/menu.utils');
  return { ...actual, setMealLogged: vi.fn() };
});

const planned = (mealType: string, description: string) => ({
  dayOfWeek: 0,
  mealType,
  description,
  kcal: 500,
  protein: null,
  carbs: null,
  fat: null,
  logged: false,
});
const PLAN = {
  menuId: 'menu-1',
  meals: [planned('breakfast', 'Oats'), planned('lunch', 'Rice bowl')],
  gymTime: null,
};
const logged = (mealType: string) => ({ mealType }) as MealLog;
const today = dateToString(new Date());

describe('NextMealCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue(PLAN);
  });

  it('words today as today', async () => {
    render(<NextMealCard date={today} loggedMeals={[]} remainingKcal={null} />);
    expect(await screen.findByText('Next planned meal')).toBeTruthy();
    expect(screen.getByText(/1 more planned today/)).toBeTruthy();
  });

  it('words a past day as that day, not today', async () => {
    render(<NextMealCard date={shiftDateStr(today, -3)} loggedMeals={[]} remainingKcal={null} />);
    expect(await screen.findByText('Planned, not logged yet')).toBeTruthy();
    expect(screen.getByText(/1 more planned that day/)).toBeTruthy();
    expect(screen.queryByText(/today/i)).toBeNull();
  });

  it('says a past day whose plan is all logged is done for that day', async () => {
    render(
      <NextMealCard
        date={shiftDateStr(today, -3)}
        loggedMeals={[logged('breakfast'), logged('lunch')]}
        remainingKcal={null}
      />,
    );
    expect(await screen.findByText(/Everything planned for that day is logged/)).toBeTruthy();
  });

  it('says so when "Log it" fails, and keeps the meal on the card', async () => {
    vi.mocked(setMealLogged).mockRejectedValueOnce(new Error('offline'));
    render(<NextMealCard date={today} loggedMeals={[]} remainingKcal={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log it' }));

    await waitFor(() => expect(screen.getByText(/Couldn.t log it/)).toBeTruthy());
    expect(screen.getByText('Oats')).toBeTruthy();
  });
});
