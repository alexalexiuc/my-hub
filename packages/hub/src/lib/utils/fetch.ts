type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface ApiFetchOptions<TBody = unknown, TQuery extends QueryParams = QueryParams> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: TQuery;
  body?: TBody;
  headers?: Record<string, string>;
  silentToast?: boolean;
}

const SUCCESS_TOAST_METHODS = new Set<ApiFetchOptions['method']>(['POST', 'PUT', 'PATCH', 'DELETE'] as const);

function showToast(kind: 'success' | 'error', message: string) {
  if (typeof window === 'undefined') return;

  // Load Sonner only in the browser at toast time to avoid coupling this shared helper to server bundles.
  void import('sonner').then(({ toast }) => {
    if (kind === 'error') {
      toast.error(message);
      return;
    }
    toast.success(message);
  });
}

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed fetch wrapper for Hub API routes.
 *
 * - Appends `query` params as a URL search string, omitting null/undefined values.
 * - Serialises plain-object `body` as JSON and sets `Content-Type: application/json`
 *   automatically. Pass a `FormData` instance to skip that behaviour.
 * - Shows a toast on request errors.
 * - Shows a success toast for `POST`/`PUT`/`PATCH`/`DELETE` requests.
 * - `GET` requests stay silent by default.
 * - Set `silentToast: true` to suppress all toasts for a specific request.
 * - Throws `ApiError` (with `.status`) on non-2xx responses.
 * - Returns `undefined` for empty responses (e.g. 204 No Content).
 */
export async function apiFetch<T = undefined, TBody = unknown, TQuery extends QueryParams = QueryParams>(
  path: string,
  options?: ApiFetchOptions<TBody, TQuery>,
): Promise<T> {
  const { method = 'GET', query, body, headers: extraHeaders = {}, silentToast = false } = options ?? {};

  let url = path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value != null) params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url = `${path}?${qs}`;
  }

  const headers: Record<string, string> = { ...extraHeaders };
  let serialisedBody: BodyInit | undefined;

  if (body !== undefined) {
    if (body instanceof FormData) {
      serialisedBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      serialisedBody = JSON.stringify(body);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body: serialisedBody,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = (await res.json()) as { error?: string; message?: string };
      message = err.error ?? err.message ?? message;
    } catch {
      console.warn('Failed to parse error response as JSON');
    }

    if (!silentToast) {
      showToast('error', message || 'Request failed');
    }

    throw new ApiError(res.status, message);
  }

  if (!silentToast && SUCCESS_TOAST_METHODS.has(method)) {
    showToast('success', method === 'DELETE' ? 'Deleted successfully' : 'Saved successfully');
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export { ApiError };
