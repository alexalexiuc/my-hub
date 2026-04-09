import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from './fetch';

// Minimal fetch mock
function makeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: (k: string) => headers[k] ?? null },
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(JSON.parse(text)),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch — success cases', () => {
  it('GETs and parses JSON', async () => {
    global.fetch = makeFetch(200, { todos: [] });
    const data = await apiFetch<{ todos: unknown[] }>('/api/todo');
    expect(data).toEqual({ todos: [] });
    expect(fetch).toHaveBeenCalledWith('/api/todo', expect.objectContaining({ method: 'GET' }));
  });

  it('appends query params, omitting null/undefined', async () => {
    global.fetch = makeFetch(200, {});
    await apiFetch('/api/meals', { query: { date: '2026-01-01', limit: 100, type: undefined, extra: null } });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe('/api/meals?date=2026-01-01&limit=100');
  });

  it('serialises plain-object body as JSON and sets Content-Type', async () => {
    global.fetch = makeFetch(201, { id: 1 });
    await apiFetch('/api/todo', { method: 'POST', body: { title: 'test' } });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ title: 'test' }));
  });

  it('passes FormData body without setting Content-Type', async () => {
    global.fetch = makeFetch(200, {});
    const form = new FormData();
    form.append('file', 'data');
    await apiFetch('/api/upload', { method: 'POST', body: form });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect(init.body).toBe(form);
  });

  it('returns undefined for empty response body', async () => {
    global.fetch = makeFetch(204, '');
    const result = await apiFetch('/api/todo/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('merges extra headers', async () => {
    global.fetch = makeFetch(200, {});
    await apiFetch('/api/x', { headers: { 'X-Custom': 'yes' } });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Custom']).toBe('yes');
  });
});

describe('apiFetch — error cases', () => {
  it('throws ApiError with status on non-2xx response', async () => {
    global.fetch = makeFetch(404, { error: 'Not found' });
    await expect(apiFetch('/api/missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('puts the status code on ApiError', async () => {
    global.fetch = makeFetch(401, { error: 'Unauthorized' });
    let caught: ApiError | null = null;
    try {
      await apiFetch('/api/protected');
    } catch (e) {
      caught = e as ApiError;
    }
    expect(caught?.status).toBe(401);
  });

  it('extracts error message from JSON body', async () => {
    global.fetch = makeFetch(400, { error: 'Bad input' });
    await expect(apiFetch('/api/x')).rejects.toThrow('Bad input');
  });

  it('falls back to statusText when body has no error field', async () => {
    global.fetch = makeFetch(500, { foo: 'bar' });
    await expect(apiFetch('/api/x')).rejects.toThrow('Error');
  });
});
