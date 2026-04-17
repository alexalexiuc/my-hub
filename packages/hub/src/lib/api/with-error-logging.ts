import { putLog } from '@my-hub/shared/services';
import { NextResponse } from 'next/server';

type MaybePromise<T> = T | Promise<T>;
type ParamsRecord = Record<string, string | string[] | undefined>;

export interface RouteContext<TParams extends ParamsRecord = ParamsRecord> {
  params: Promise<TParams>;
}

interface ErrorLoggingOptions {
  userId?: string;
  clientId?: string;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown server error';
}

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get('x-real-ip')?.trim();
  return realIp || undefined;
}

async function writeApiLog(
  req: Request,
  statusCode: number,
  durationMs: number,
  error?: string,
  options?: ErrorLoggingOptions,
) {
  try {
    const url = new URL(req.url);
    await putLog({
      service: 'hub',
      method: req.method,
      path: url.pathname,
      statusCode,
      durationMs,
      ip: getClientIp(req),
      userId: options?.userId,
      clientId: options?.clientId,
      error,
    });
  } catch (logErr) {
    console.error('[api-log] failed to persist request log', logErr);
  }
}

export function withErrorLogging<TRequest extends Request = Request>(
  handler: (req: TRequest) => MaybePromise<Response>,
  options?: ErrorLoggingOptions,
): (req: TRequest) => Promise<Response>;
export function withErrorLogging<TRequest extends Request = Request, TParams extends ParamsRecord = ParamsRecord>(
  handler: (req: TRequest, context: RouteContext<TParams>) => MaybePromise<Response>,
  options?: ErrorLoggingOptions,
): (req: TRequest, context: RouteContext<TParams>) => Promise<Response>;

export function withErrorLogging<TRequest extends Request = Request, TParams extends ParamsRecord = ParamsRecord>(
  handler:
    | ((req: TRequest) => MaybePromise<Response>)
    | ((req: TRequest, context: RouteContext<TParams>) => MaybePromise<Response>),
  options?: ErrorLoggingOptions,
): (req: TRequest, context?: RouteContext<TParams>) => Promise<Response> {
  return async (req: TRequest, context?: RouteContext<TParams>) => {
    const start = Date.now();

    try {
      const response = context
        ? await (handler as (req: TRequest, context: RouteContext<TParams>) => MaybePromise<Response>)(req, context)
        : await (handler as (req: TRequest) => MaybePromise<Response>)(req);

      writeApiLog(req, response.status, Date.now() - start, undefined, options).catch(logErr => {
        console.error('[api-log] failed to persist request log', logErr);
      });
      return response;
    } catch (err) {
      const errorMessage = toErrorMessage(err);
      await writeApiLog(req, 500, Date.now() - start, errorMessage, options);
      console.error(`[api] ${req.method} ${req.url} failed`, err);

      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}
