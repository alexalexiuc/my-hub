import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { todos } from '../../db/schema/todos';
import type { Todo } from '../../types/index';

export async function getTodos(userId: string): Promise<Todo[]> {
  return db.select().from(todos).where(eq(todos.userId, userId)).orderBy(todos.createdAt);
}

export async function getOpenTodos(userId: string): Promise<Todo[]> {
  return db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), eq(todos.done, false)))
    .orderBy(todos.createdAt);
}

export async function addTodo(userId: string, title: string): Promise<Todo> {
  const [row] = await db.insert(todos).values({ userId, title }).returning();
  if (!row) throw new Error('Insert did not return a row');
  return row;
}

export async function markTodoDone(userId: string, id: number): Promise<Todo | null> {
  const [row] = await db
    .update(todos)
    .set({ done: true })
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteTodo(userId: string, id: number): Promise<Todo | null> {
  const [row] = await db
    .delete(todos)
    .where(and(eq(todos.userId, userId), eq(todos.id, id)))
    .returning();
  return row ?? null;
}

export async function deleteAllUserTodos(userId: string): Promise<number> {
  const rows = await db.delete(todos).where(eq(todos.userId, userId)).returning({ id: todos.id });
  return rows.length;
}
