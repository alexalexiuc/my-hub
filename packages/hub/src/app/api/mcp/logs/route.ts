import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getLogs } from '@my-hub/shared/services';

export const GET = withAuth(async ({ req, user }) => {
  const url = new URL(req.url);
  const service = url.searchParams.get('service') ?? undefined;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const logs = await getLogs({
    userId: user.id,
    service,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to + 'T23:59:59.999Z') : undefined,
    limit,
  });

  return NextResponse.json({ logs });
});
