import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-user';
import { getTodos, addTodo } from '@my-hub/shared/services';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const items = await getTodos(user.id);
  return NextResponse.json({ todos: items });
}

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}
