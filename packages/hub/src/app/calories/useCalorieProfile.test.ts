import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '@/lib/utils';
import { useCalorieProfile } from './useCalorieProfile';
import { NOT_SIGNED_IN } from './ui';

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, apiFetch: vi.fn() };
});

const fetchMock = vi.mocked(apiFetch);
const DATA = { profile: { goalMaxCalories: 2300 }, measurements: [{ typeKey: 'weight', value: 80 }] };

describe('useCalorieProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('loads the profile and latest measurements, loading until they arrive', async () => {
    fetchMock.mockResolvedValueOnce(DATA);
    const { result } = renderHook(() => useCalorieProfile());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toEqual(DATA.profile);
    expect(result.current.measurements).toEqual(DATA.measurements);
    expect(result.current.error).toBeNull();
  });

  it('reports a failed first load, as "Not signed in" for a 401', async () => {
    fetchMock.mockRejectedValueOnce(new ApiError(401, 'Unauthorized'));
    const { result } = renderHook(() => useCalorieProfile());
    await waitFor(() => expect(result.current.error).toBe(NOT_SIGNED_IN));
    expect(result.current.loading).toBe(false);
  });

  it('keeps what is on screen when a background reload fails, and asks for no toast', async () => {
    fetchMock.mockResolvedValueOnce(DATA);
    const { result } = renderHook(() => useCalorieProfile());
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.reload(true));
    expect(result.current.profile).toEqual(DATA.profile);
    expect(result.current.error).toBeNull();
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ silentToast: true });
  });

  it('reloads quietly when the user comes back to the page', async () => {
    fetchMock.mockResolvedValueOnce(DATA);
    const { result } = renderHook(() => useCalorieProfile());
    await waitFor(() => expect(result.current.profile).not.toBeNull());

    const fresh = { ...DATA, profile: { goalMaxCalories: 2500 } };
    fetchMock.mockResolvedValueOnce(fresh);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(result.current.profile).toEqual(fresh.profile));
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ silentToast: true });
  });

  it('makes no request when skipped, and is not loading', () => {
    const { result } = renderHook(() => useCalorieProfile({ skip: true }));
    window.dispatchEvent(new Event('focus'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
