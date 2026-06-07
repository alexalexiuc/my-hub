import type { ZodType } from 'zod';
import { z } from 'zod';
import { formatZodError } from '@/lib/api';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Resolves to the schema's inferred output type, or `TFallback` when no schema is supplied. */
type SchemaOutput<TSchema extends ZodType | undefined, TFallback> = TSchema extends ZodType
  ? z.infer<TSchema>
  : TFallback;

/** Resolves to the schema's input type (pre-parse/transform), or `TFallback` when no schema is supplied. */
type SchemaInput<TSchema extends ZodType | undefined, TFallback> = TSchema extends ZodType
  ? z.input<TSchema>
  : TFallback;

interface ApiFetchOptions<
  TBody = unknown,
  TQuery extends QueryParams = QueryParams,
  TResponseSchema extends ZodType | undefined = undefined,
  TBodySchema extends ZodType | undefined = undefined,
> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: TQuery;
  body?: SchemaInput<TBodySchema, TBody>;
  headers?: Record<string, string>;
  silentToast?: boolean;
  /** Validates the JSON response and infers the resolved type — pass the same schema the API route declares as `response`. */
  responseSchema?: TResponseSchema;
  /** Validates (and applies any Zod transforms to) the outgoing body — pass the same schema the API route declares as `body`. */
  bodySchema?: TBodySchema;
}

function parseOrThrow<TSchema extends ZodType>(schema: TSchema, value: unknown, context: string): z.infer<TSchema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid ${context}: ${formatZodError(parsed.error)}`);
  }
  return parsed.data as z.infer<TSchema>;
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
 *
 * Pass `responseSchema`/`bodySchema` — the same Zod schemas the API route declares via
 * `route({ response, body })` — to derive `apiFetch`'s types directly from the route's real
 * contract instead of hand-duplicating interfaces, and to validate payloads at runtime:
 *
 * @example
 *   const data = await apiFetch('/api/calories/menu', { responseSchema: GetMenusResponseSchema });
 *   //    ^? z.infer<typeof GetMenusResponseSchema>
 *
 *   await apiFetch(`/api/calories/menu/${menuId}/meals`, {
 *     method: 'POST',
 *     body: { dayOfWeek, mealType, description },
 *     bodySchema: MenuMealWriteSchema,
 *     responseSchema: MenuMealResponseSchema,
 *   });
 */
export async function apiFetch<
  T = undefined,
  TBody = unknown,
  TQuery extends QueryParams = QueryParams,
  TResponseSchema extends ZodType | undefined = undefined,
  TBodySchema extends ZodType | undefined = undefined,
>(
  path: string,
  options?: ApiFetchOptions<TBody, TQuery, TResponseSchema, TBodySchema>,
): Promise<SchemaOutput<TResponseSchema, T>> {
  const {
    method = 'GET',
    query,
    body,
    headers: extraHeaders = {},
    silentToast = false,
    responseSchema,
    bodySchema,
  } = options ?? {};

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
      const validatedBody = bodySchema ? parseOrThrow(bodySchema, body, 'request body') : body;
      headers['Content-Type'] = 'application/json';
      serialisedBody = JSON.stringify(validatedBody);
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
  const json = text ? (JSON.parse(text) as unknown) : undefined;

  if (responseSchema) {
    return parseOrThrow(responseSchema, json, 'response body') as SchemaOutput<TResponseSchema, T>;
  }

  return json as SchemaOutput<TResponseSchema, T>;
}

export { ApiError };
