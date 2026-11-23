import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealLog } from '@my-hub/shared/types';
import { apiFetch, ApiError } from '@/lib/utils';
import { MealsSection } from './MealsSection';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn() };
});

const DATE = '2026-11-22';
const meal = (over: Partial<MealLog>) =>
  ({
    id: 1,
    mealId: 'm1',
    date: DATE,
    mealType: 'breakfast',
    description: 'Black coffee',
    kcal: 5,
    protein: null,
    carbs: null,
    fat: null,
    notes: null,
    ...over,
  }) as MealLog;

const renderSection = (props: Partial<Parameters<typeof MealsSection>[0]> = {}) =>
  render(<MealsSection meals={[]} selectedDate={DATE} gymTime={null} onChanged={vi.fn()} {...props} />);

describe('MealsSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prints no stray "0" for a meal whose macros are all zero', () => {
    renderSection({ meals: [meal({ protein: 0, carbs: 0, fat: 0 })] });
    const row = screen.getAllByText('Black coffee')[0]!.parentElement!;
    expect(row.textContent).toBe('Black coffee5 kcal');
  });

  it('shows the macros that are set and skips the zero ones', () => {
    renderSection({ meals: [meal({ protein: 12, carbs: 0, fat: 3 })] });
    expect(screen.getAllByText('P 12g · F 3g').length).toBeGreaterThan(0);
  });

  it('while the day loads, shows neither the empty state nor the copy offer', () => {
    renderSection({ loading: true });
    expect(screen.getByText('Loading meals…')).toBeTruthy();
    expect(screen.queryByText(/No meals logged/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy meals from/ })).toBeNull();
  });

  it('copies yesterday through the copy endpoint, only onto an empty day', async () => {
    const onChanged = vi.fn();
    vi.mocked(apiFetch).mockResolvedValueOnce({ meals: [meal({})] });
    renderSection({ onChanged });

    fireEvent.click(screen.getByRole('button', { name: /Copy meals from/ }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith('/api/calories/meals/copy', {
      method: 'POST',
      body: { fromDate: '2026-11-21', toDate: DATE, onlyIfEmpty: true },
      silentToast: true,
    });
  });

  it("says why when the server refuses the copy, and reloads the day it hadn't seen", async () => {
    const onChanged = vi.fn();
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new ApiError(400, '2026-11-22 already has meals logged — nothing was copied'),
    );
    renderSection({ onChanged });

    fireEvent.click(screen.getByRole('button', { name: /Copy meals from/ }));
    expect(await screen.findByText(/already has meals logged/)).toBeTruthy();
    expect(onChanged).toHaveBeenCalled();
  });

  it('says nothing was copied when yesterday was empty', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ meals: [] });
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: /Copy meals from/ }));
    expect(await screen.findByText(/to copy\./)).toBeTruthy();
  });
});
