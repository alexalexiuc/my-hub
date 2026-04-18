import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getE2eEnv } from './helpers/env.js';
import { generateToken } from './helpers/token.js';
import { createMcpClient, parseToolResult, type McpClient } from './helpers/mcp-client.js';

interface TodoItem {
  id: number;
  userId: string;
  title: string;
  done: boolean;
  createdAt: string;
}

/**
 * E2E tests for the todo MCP sub-server.
 *
 * Exercises the full lifecycle via the MCP protocol:
 *   add → list → mark done → verify done → resource shows only open items
 *
 * A unique run ID is embedded in the title so test items can be identified
 * among real data without relying on a test-only database.
 */
describe.sequential('todo — lifecycle', () => {
  let client: McpClient;
  let todoId: number | undefined;

  const runId = Date.now().toString(36);
  const todoTitle = `[e2e:${runId}] Buy milk`;

  beforeAll(async () => {
    const { baseUrl } = getE2eEnv();
    const token = await generateToken();
    client = await createMcpClient(baseUrl, '/todo/mcp', token);
  });

  afterAll(async () => {
    // Best-effort cleanup of the todo created by this test run.
    if (todoId != null) {
      try {
        await client.callTool({
          name: 'todo_delete',
          arguments: { id: todoId },
        });
      } catch {
        // Ignore cleanup failures: do not fail the test suite if deletion fails.
      }
    }

    await client.close();
  });

  it('adds a todo item and returns it', async () => {
    const result = await client.callTool({
      name: 'todo_add',
      arguments: { title: todoTitle },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<TodoItem>(result);

    expect(data.id).toBeGreaterThan(0);
    expect(data.title).toBe(todoTitle);
    expect(data.done).toBe(false);
    expect(data.createdAt).toBeTruthy();

    todoId = data.id;
  });

  it('todo_list returns the added item', async () => {
    expect(todoId).toBeDefined();

    const result = await client.callTool({ name: 'todo_list', arguments: {} });

    expect(result.isError).toBeFalsy();
    const items = parseToolResult<TodoItem[]>(result);

    expect(Array.isArray(items)).toBe(true);
    const found = items.find(t => t.id === todoId);
    expect(found).toBeDefined();
    expect(found!.title).toBe(todoTitle);
    expect(found!.done).toBe(false);
  });

  it('todo://open resource includes the open item', async () => {
    expect(todoId).toBeDefined();

    const result = await client.readResource({ uri: 'todo://open' });

    const raw = result.contents[0];
    expect(raw).toBeDefined();
    const data = JSON.parse(raw!.text as string) as { openTodos: TodoItem[]; count: number };

    expect(typeof data.count).toBe('number');
    expect(Array.isArray(data.openTodos)).toBe(true);
    const found = data.openTodos.find(t => t.id === todoId);
    expect(found).toBeDefined();
    expect(found!.done).toBe(false);
  });

  it('marks the todo as done', async () => {
    expect(todoId).toBeDefined();

    const result = await client.callTool({
      name: 'todo_mark_done',
      arguments: { id: todoId },
    });

    expect(result.isError).toBeFalsy();
    const data = parseToolResult<TodoItem>(result);

    expect(data.id).toBe(todoId);
    expect(data.done).toBe(true);
  });

  it('todo_list shows item as done', async () => {
    expect(todoId).toBeDefined();

    const result = await client.callTool({ name: 'todo_list', arguments: {} });

    const items = parseToolResult<TodoItem[]>(result);
    const found = items.find(t => t.id === todoId);
    expect(found).toBeDefined();
    expect(found!.done).toBe(true);
  });

  it('todo://open resource no longer includes the done item', async () => {
    expect(todoId).toBeDefined();

    const result = await client.readResource({ uri: 'todo://open' });

    const raw = result.contents[0];
    const data = JSON.parse(raw!.text as string) as { openTodos: TodoItem[]; count: number };

    const found = data.openTodos.find(t => t.id === todoId);
    expect(found).toBeUndefined();
  });

  it('returns an error when marking a non-existent id as done', async () => {
    const result = await client.callTool({
      name: 'todo_mark_done',
      arguments: { id: 999_999_999 },
    });

    expect(result.isError).toBe(true);
  });
});
