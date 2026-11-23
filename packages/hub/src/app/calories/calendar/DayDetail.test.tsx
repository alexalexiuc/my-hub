import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dateToString, shiftDateStr } from '@my-hub/shared/utils';
import { apiFetch } from '@/lib/utils';
import { DayDetail } from './DayDetail';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn() };
});

const PAST = shiftDateStr(dateToString(new Date()), -5);
const MEAL = { id: 1, mealId: 'm1', date: PAST, mealType: 'lunch', description: 'Rice bowl', kcal: 600 };

/** Answers the day's two loads; `copy` decides how "Log this day again today" goes. */
function mockApi({ loadFails = false, copy }: { loadFails?: boolean; copy?: () => Promise<unknown> } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (url === '/api/calories/meals/copy') return copy!();
    if (loadFails) throw new Error('Server down');
    if (url === '/api/calories/meals') return { meals: [MEAL] };
    if (url === '/api/calories/menu/today') return { menuId: null, meals: [], gymTime: null };
    throw new Error(`unexpected ${url}`);
  });
}

describe('DayDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it("says so when the day can't load, instead of loading forever", async () => {
    mockApi({ loadFails: true });
    render(<DayDetail date={PAST} profile={null} />);
    expect(await screen.findByText(/Couldn.t load this day.s meals/)).toBeTruthy();
  });

  it('copies the day onto today through the copy endpoint and says how many', async () => {
    mockApi({ copy: async () => ({ meals: [MEAL] }) });
    render(<DayDetail date={PAST} profile={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log this day again today' }));

    expect(await screen.findByText(/Logged 1 meal to today/)).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/calories/meals/copy',
      expect.objectContaining({
        method: 'POST',
        body: { fromDate: PAST, toDate: dateToString(new Date()), onlyIfEmpty: false },
      }),
    );
  });

  it('says nothing was copied when the copy fails, and lets you try again', async () => {
    mockApi({ copy: async () => Promise.reject(new Error('offline')) });
    render(<DayDetail date={PAST} profile={null} />);
    const button = await screen.findByRole('button', { name: 'Log this day again today' });
    fireEvent.click(button);

    expect(await screen.findByText(/nothing was copied/)).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
