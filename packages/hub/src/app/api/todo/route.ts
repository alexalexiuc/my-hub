import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { formatZodError } from '@/lib/api/with-error-logging';
import { getTodos, addTodo } from '@my-hub/shared/services';
import { TodoCreateSchema } from '@my-hub/shared/schemas';

export const GET = withAuth(async ({ user }) => {
  const items = await getTodos(user.id);
  return NextResponse.json({ todos: items });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = TodoCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const todo = await addTodo(user.id, parsed.data.title);
  return NextResponse.json({ todo }, { status: 201 });
});
