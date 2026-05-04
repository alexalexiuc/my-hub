import { consumePasswordResetToken } from '@my-hub/shared/services';
import { ResetPasswordSchema } from '@/lib/schemas/auth';
import { route, routeHttpError } from '@/lib/api/route';

export const POST = route({ public: true, body: ResetPasswordSchema })(async ({ body }) => {
  const ok = await consumePasswordResetToken(body.token, body.password);

  if (!ok) {
    return routeHttpError(400, 'Reset link is invalid or has expired');
  }

  return { ok: true };
});
