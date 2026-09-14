import { useCallback, useEffect, useRef, useState } from 'react';
import { readLocalCache, writeLocalCache } from '@/lib/utils/localCache';

interface UseCachedResourceOptions<T> {
  /**
   * Namespaced localStorage key — vary per data source and, where data is user-specific, per
   * user. Pass `null` while the real key isn't known yet (e.g. an auth session still resolving)
   * to skip caching/fetching entirely rather than fetching once under a throwaway key.
   */
  cacheKey: string | null;
  /** Fetches the fresh value. Return `undefined` to mean "no update this round" (existing data/cache is left untouched). */
  fetcher: () => Promise<T | undefined>;
  /** Type guard used to validate a cached value read from localStorage before trusting it. */
  isValid: (value: unknown) => value is T;
}

interface UseCachedResourceResult<T> {
  data: T | null;
  /** Optimistically updates the in-memory value and writes it through to the cache. */
  setData: (value: T) => void;
  /** True on the very first load and during every background revalidation. */
  isRefreshing: boolean;
  reload: () => void;
}

/**
 * Paints instantly from a cached localStorage value (if any) while always revalidating
 * in the background — the caller decides whether to show a full loading skeleton
 * (no `data` yet) or a subtle "refreshing" indicator (`data` present, `isRefreshing` true).
 */
export function useCachedResource<T>({
  cacheKey,
  fetcher,
  isValid,
}: UseCachedResourceOptions<T>): UseCachedResourceResult<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  const setData = useCallback((value: T) => {
    setDataState(value);
    if (cacheKeyRef.current) writeLocalCache(cacheKeyRef.current, value);
  }, []);

  const load = useCallback(async () => {
    if (!cacheKeyRef.current) return;
    setIsRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (result !== undefined) setData(result);
    } finally {
      setIsRefreshing(false);
    }
  }, [setData]);

  useEffect(() => {
    // Skip entirely while cacheKey isn't known yet (e.g. an auth session still resolving) —
    // fetching once under a throwaway key and again once the real key arrives would double-fetch.
    if (!cacheKey) return;
    // Read the cache in an effect rather than a lazy useState initializer to avoid an
    // SSR/hydration mismatch (localStorage isn't available on the server).
    setDataState(readLocalCache(cacheKey, isValid));
    load();
  }, [cacheKey]);

  return { data, setData, isRefreshing, reload: load };
}
