/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ZodType } from 'zod';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { formatZodError, writeApiLog } from './with-error-logging';
import { logger } from '@my-hub/shared/utils';
import { hubEnvConfig } from '@/config/env';

type MaybePromise<T> = T | Promise<T>;

type HandlerResult<TResponse extends ZodType | undefined> = TResponse extends ZodType
  ? z.infer<TResponse> | Response
  : RouteResult;

type RouteJsonValue = string | number | boolean | null | object | unknown[];

export type RouteResult = Response | RouteJsonValue;

type UserContext = {
  id: string;
  name: string | null;
  email: string;
};

/**
 * Context passed to every route handler. Fields `params`, `body`, and `query`
 * are only present when the corresponding Zod schema is supplied to `route()`.
 *
 * @example No validation
 *   export const GET = route(async ({ user }) => { ... })
 *
 * @example Body validation
 *   export const POST = route({ body: MySchema })(async ({ user, body }) => { ... })
 *
 * @example Params + body
 *   export const PATCH = route({ params: z.object({ id: z.string() }), body: MySchema })(
 *     async ({ user, params, body }) => { ... },
 *   )
 */
export type RouteContext<
  TParams extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TPublic extends boolean = false,
> = {
  req: Request;
  user: TPublic extends true ? UserContext | null : UserContext;
} & (TParams extends ZodType ? { params: z.infer<TParams> } : object) &
  (TBody extends ZodType ? { body: z.infer<TBody> } : object) &
  (TQuery extends ZodType ? { query: z.infer<TQuery> } : object);

type NextRouteHandler = (req: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>;

type RouteSchemas<
  TParams extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TResponse extends ZodType | undefined = undefined,
> = {
  params?: TParams;
  body?: TBody;
  query?: TQuery;
  response?: TResponse;
};

type ProtectedRouteOptions<
  TParams extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TResponse extends ZodType | undefined = undefined,
> = RouteSchemas<TParams, TBody, TQuery, TResponse> & {
  public?: false;
};

type PublicRouteOptions<
  TParams extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TResponse extends ZodType | undefined = undefined,
> = RouteSchemas<TParams, TBody, TQuery, TResponse> & {
  public: true;
};

type AnyRouteOptions = {
  params?: ZodType;
  body?: ZodType;
  query?: ZodType;
  response?: ZodType;
  public?: boolean;
};

export class RouteHttpError extends Error {
  readonly status: number;
  readonly payload: RouteJsonValue;

  constructor(status: number, payload: RouteJsonValue = { error: 'Internal Server Error' }) {
    const message =
      typeof payload === 'string'
        ? payload
        : typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `HTTP ${status}`;
    super(message);
    this.name = 'RouteHttpError';
    this.status = status;
    this.payload = payload;
  }

  toResponse(): Response {
    const payload = typeof this.payload === 'string' ? { error: this.payload } : this.payload;
    return NextResponse.json(payload, { status: this.status });
  }
}

export function routeHttpError(status: number, payload: RouteJsonValue = { error: 'Internal Server Error' }): never {
  throw new RouteHttpError(status, payload);
}

/** Return a 201 Created JSON response from a route handler. */
export function created(payload: RouteJsonValue): Response {
  return NextResponse.json(payload, { status: 201 });
}

/** Return a 204 No Content response from a route handler. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

function toResponse(result: RouteResult): Response {
  if (result instanceof Response) {
    return result;
  }

  return NextResponse.json(result);
}

async function validateJsonResponse(response: Response, schema: ZodType): Promise<string | null> {
  let payload: unknown;

  if ([204, 205, 304].includes(response.status)) {
    payload = undefined;
  } else {
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      return 'Response schema validation requires a JSON response';
    }

    const bodyText = await response.clone().text();
    if (!bodyText.trim()) {
      payload = undefined;
    } else {
      try {
        payload = JSON.parse(bodyText);
      } catch {
        return 'Response body is not valid JSON';
      }
    }
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return formatZodError(parsed.error);
  }

  return null;
}

function createRouteHandler<
  TParams extends ZodType | undefined,
  TBody extends ZodType | undefined,
  TQuery extends ZodType | undefined,
  TResponse extends ZodType | undefined,
  TPublic extends boolean,
>(
  handler: (ctx: RouteContext<TParams, TBody, TQuery, TPublic>) => MaybePromise<RouteResult>,
  options?:
    | (RouteSchemas<TParams, TBody, TQuery, TResponse> & {
        public?: TPublic;
      })
    | null,
): NextRouteHandler {
  return async (req, context) => {
    const start = Date.now();
    let userId: string | undefined;
    const log = (statusCode: number, error?: string, userId?: string) =>
      writeApiLog(req, statusCode, Date.now() - start, error, userId ? { userId } : undefined).catch(() => {});
    const payloads: Record<string, unknown> = {};

    try {
      const isPublicRoute = options?.public === true;
      const authUser = await getAuthUser();
      if (!isPublicRoute && !authUser) {
        void log(401);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const user = authUser
        ? ({ id: authUser.id, name: authUser.name, email: authUser.email } satisfies UserContext)
        : null;
      if (user) {
        userId = user.id;
      }
      const ctx: Record<string, unknown> = { req, user };

      if (options?.params) {
        if (!context?.params) {
          void log(500, 'No context.params for route with params schema', userId);
          return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        const rawParams = await context.params;
        const parsed = options.params.safeParse(rawParams);
        if (!parsed.success) {
          void log(400, formatZodError(parsed.error), userId);
          return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        }
        ctx.params = parsed.data;
        payloads.params = parsed.data;
      }

      if (options?.body) {
        let rawBody: unknown;
        try {
          rawBody = await req.json();
        } catch {
          void log(400, 'Invalid JSON', userId);
          return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }
        const parsed = options.body.safeParse(rawBody);
        if (!parsed.success) {
          void log(400, formatZodError(parsed.error), userId);
          return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        }
        ctx.body = parsed.data;
        payloads.body = parsed.data;
      }

      if (options?.query) {
        const rawQuery = Object.fromEntries(new URL(req.url).searchParams.entries());
        const parsed = options.query.safeParse(rawQuery);
        if (!parsed.success) {
          void log(400, formatZodError(parsed.error), userId);
          return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        }
        ctx.query = parsed.data;
        payloads.query = parsed.data;
      }

      const response = toResponse(await handler(ctx as RouteContext<TParams, TBody, TQuery, TPublic>));

      if (options?.response) {
        const responseValidationError = await validateJsonResponse(response, options.response);
        if (responseValidationError) {
          await log(500, `Invalid response payload: ${responseValidationError}`, userId);
          return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
      }

      void log(response.status, undefined, userId);
      return response;
    } catch (err) {
      if (err instanceof RouteHttpError) {
        await log(err.status, err.message, userId);
        return err.toResponse();
      }

      const message = err instanceof Error ? err.message : 'Unknown server error';
      await log(500, message, userId);
      logger.error(`[api] ${req.method} ${new URL(req.url).pathname} 500 in ${Date.now() - start}ms —`, err);
      if (hubEnvConfig.PRINT_PAYLOADS) logger.error('[api] request payloads:', JSON.stringify(payloads));
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}

/** Route handler with no validation — receives `{ req, user }`. */
export function route(handler: (ctx: RouteContext) => MaybePromise<RouteResult>): NextRouteHandler;

/** Route handler with Zod validation and protected auth — call with options, then pass the handler. */
export function route<
  TParams extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TResponse extends ZodType | undefined = undefined,
>(
  options: ProtectedRouteOptions<TParams, TBody, TQuery, TResponse>,
): (
  handler: (ctx: RouteContext<TParams, TBody, TQuery, false>) => MaybePromise<HandlerResult<TResponse>>,
) => NextRouteHandler;

/** Route handler with Zod validation and public auth mode — call with options, then pass the handler. */
export function route<
  TParams extends ZodType | undefined = undefined,
  TBody extends ZodType | undefined = undefined,
  TQuery extends ZodType | undefined = undefined,
  TResponse extends ZodType | undefined = undefined,
>(
  options: PublicRouteOptions<TParams, TBody, TQuery, TResponse>,
): (
  handler: (ctx: RouteContext<TParams, TBody, TQuery, true>) => MaybePromise<HandlerResult<TResponse>>,
) => NextRouteHandler;

export function route(
  schemasOrHandler: AnyRouteOptions | ((ctx: any) => MaybePromise<RouteResult>),
): NextRouteHandler | ((handler: (ctx: any) => MaybePromise<RouteResult>) => NextRouteHandler) {
  if (typeof schemasOrHandler === 'function') {
    return createRouteHandler(schemasOrHandler as (ctx: RouteContext) => MaybePromise<RouteResult>);
  }
  return (handler: (ctx: RouteContext) => MaybePromise<RouteResult>) =>
    createRouteHandler(handler, schemasOrHandler as ProtectedRouteOptions);
}
