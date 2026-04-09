type QueryParams = Record<string, string | number | boolean | null | undefined>;

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: QueryParams;
  body?: unknown;
  headers?: Record<string, string>;
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
 * - Throws `ApiError` (with `.status`) on non-2xx responses.
 * - Returns `undefined` for empty responses (e.g. 204 No Content).
 */
export async function apiFetch<T = undefined>(path: string, options?: ApiFetchOptions): Promise<T> {
  const { method = 'GET', query, body, headers: extraHeaders = {} } = options ?? {};

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
      // ignore parse failures
    }
    throw new ApiError(res.status, message);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export { ApiError };
