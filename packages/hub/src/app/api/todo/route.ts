import { z } from 'zod';
import { route, created } from '@/lib/api/route';
import { getTodos, addTodo } from '@my-hub/shared/services';

const TodoCreateSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
});

export const GET = route(async ({ user }) => {
  const items = await getTodos(user.id);
  return { todos: items };
});

export const POST = route({ body: TodoCreateSchema })(async ({ user, body }) => {
  const todo = await addTodo(user.id, body.title);
  return created({ todo });
});
