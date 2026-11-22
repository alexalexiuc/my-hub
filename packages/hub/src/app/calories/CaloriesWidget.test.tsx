import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/utils';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CaloriesWidget } from './CaloriesWidget';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn() };
});

const PROFILE = { goalMaxCalories: 2000, goalMinCalories: 1500, gymDays: [], goalProtein: null };

/** Answers by endpoint; `fail` names the ones that reject. */
function mockApi({ kcal = 0, fail = [] as string[] } = {}) {
  vi.mocked(apiFetch).mockImplementation(async (url: string) => {
    if (fail.some(f => url.startsWith(f))) throw new Error('Server down');
    if (url === '/api/calories/profile') return { profile: PROFILE, measurements: [] };
    if (url === '/api/calories/meals') return { meals: [{ kcal, protein: 0, carbs: 0, fat: 0 }] };
    if (url === '/api/calories/calendar') return { days: [] };
    throw new Error(`unexpected ${url}`);
  });
}

const renderWidget = () =>
  render(
    <ThemeProvider initial={{}}>
      <CaloriesWidget />
    </ThemeProvider>,
  );

describe('CaloriesWidget', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says it could not load, instead of "No goal set", when the profile fails', async () => {
    mockApi({ fail: ['/api/calories/profile'] });
    renderWidget();
    expect(await screen.findByText(/Couldn.t load today.s calories/)).toBeTruthy();
    expect(screen.queryByText(/No goal set/)).toBeNull();
  });

  it("says it could not load when today's meals fail", async () => {
    mockApi({ fail: ['/api/calories/meals'] });
    renderWidget();
    expect(await screen.findByText(/Couldn.t load today.s calories/)).toBeTruthy();
  });

  it('does not flag a day below its floor — the day is still in progress', async () => {
    mockApi({ kcal: 400 });
    renderWidget();
    const range = await screen.findByText('Target range: 1500-2000 kcal');
    expect(range.className).toContain('text-[var(--muted)]');
  });

  it('flags a day past its ceiling in red', async () => {
    mockApi({ kcal: 2400 });
    renderWidget();
    const range = await screen.findByText('Target range: 1500-2000 kcal');
    expect(range.className).toContain('text-[var(--red)]');
  });
});
