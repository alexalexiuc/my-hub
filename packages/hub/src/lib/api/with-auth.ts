import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { withErrorLogging } from './with-error-logging';

type MaybePromise<T> = T | Promise<T>;

type ParamsRecord = Record<string, string | string[] | undefined>;

type UserContext = {
  id: string;
  name: string | null;
  email: string;
};

export interface RouteContext<TParams extends ParamsRecord = ParamsRecord> {
  params: Promise<TParams>;
}

export interface AuthContext {
  req: Request;
  user: UserContext;
}

export interface AuthContextWithParams<TParams extends ParamsRecord = ParamsRecord> extends AuthContext {
  params: Promise<TParams>;
}

export function withAuth(handler: (ctx: AuthContext) => MaybePromise<Response>): (req: Request) => Promise<Response>;
export function withAuth<TParams extends ParamsRecord = ParamsRecord>(
  handler: (ctx: AuthContextWithParams<TParams>) => MaybePromise<Response>,
): (req: Request, context: RouteContext<TParams>) => Promise<Response>;

export function withAuth<TParams extends ParamsRecord = ParamsRecord>(
  handler:
    | ((ctx: AuthContext) => MaybePromise<Response>)
    | ((ctx: AuthContextWithParams<TParams>) => MaybePromise<Response>),
): (req: Request, context?: RouteContext<TParams>) => Promise<Response> {
  return withErrorLogging(async (req: Request, context?: RouteContext<TParams>) => {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userContext: UserContext = { id: user.id, name: user.name, email: user.email };

    if (context) {
      return (handler as (ctx: AuthContextWithParams<TParams>) => MaybePromise<Response>)({
        req,
        user: userContext,
        params: context.params,
      });
    }

    return (handler as (ctx: AuthContext) => MaybePromise<Response>)({ req, user: userContext });
  });
}
