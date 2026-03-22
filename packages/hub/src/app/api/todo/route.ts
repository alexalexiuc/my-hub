import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';
import { getTodos, addTodo } from '@my-hub/shared/services';

export const GET = withAuth(async ({ user }) => {
  const items = await getTodos(user.id);
  return NextResponse.json({ todos: items });
});

export const POST = withAuth(async ({ req, user }) => {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title } = body as { title?: string };
  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const todo = await addTodo(user.id, title.trim());
  return NextResponse.json({ todo }, { status: 201 });
});
