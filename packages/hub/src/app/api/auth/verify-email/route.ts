import { z } from 'zod';
import { consumeEmailVerificationToken } from '@my-hub/shared/services';
import { route, routeHttpError } from '@/lib/api/route';

const VerifyEmailBodySchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const POST = route({ public: true, body: VerifyEmailBodySchema })(async ({ body }) => {
  const ok = await consumeEmailVerificationToken(body.token);
  if (!ok) {
    return routeHttpError(400, 'Verification link is invalid or has expired');
  }

  return { ok: true };
});
