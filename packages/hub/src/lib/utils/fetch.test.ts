import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
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
    global.fetch = makeFetch(200, { trips: [] });
    const data = await apiFetch<{ trips: unknown[] }>('/api/travel/trips');
    expect(data).toEqual({ trips: [] });
    expect(fetch).toHaveBeenCalledWith('/api/travel/trips', expect.objectContaining({ method: 'GET' }));
  });

  it('appends query params, omitting null/undefined', async () => {
    global.fetch = makeFetch(200, {});
    await apiFetch('/api/meals', { query: { date: '2026-01-01', limit: 100, type: undefined, extra: null } });
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toBe('/api/meals?date=2026-01-01&limit=100');
  });

  it('serialises plain-object body as JSON and sets Content-Type', async () => {
    global.fetch = makeFetch(201, { id: 1 });
    await apiFetch('/api/travel/trips', { method: 'POST', body: { name: 'test' } });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ name: 'test' }));
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
    const result = await apiFetch('/api/travel/trips/1', { method: 'DELETE' });
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

describe('apiFetch — schema-driven contracts', () => {
  const TripSchema = z.object({ id: z.number(), name: z.string() });
  const ResponseSchema = z.object({ trips: z.array(TripSchema) });
  const BodySchema = z.object({ name: z.string().trim().min(1) });

  it('parses and types the response via responseSchema', async () => {
    global.fetch = makeFetch(200, { trips: [{ id: 1, name: 'Lisbon' }] });
    const data = await apiFetch('/api/travel/trips', { responseSchema: ResponseSchema });
    expect(data).toEqual({ trips: [{ id: 1, name: 'Lisbon' }] });
  });

  it('throws when the response does not match responseSchema', async () => {
    global.fetch = makeFetch(200, { trips: [{ id: 'not-a-number', name: 'Lisbon' }] });
    await expect(apiFetch('/api/travel/trips', { responseSchema: ResponseSchema })).rejects.toThrow(
      'Invalid response body',
    );
  });

  it('validates and transforms the outgoing body via bodySchema', async () => {
    global.fetch = makeFetch(201, { trips: [] });
    await apiFetch('/api/travel/trips', { method: 'POST', body: { name: '  Lisbon  ' }, bodySchema: BodySchema });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ name: 'Lisbon' }));
  });

  it('throws when the outgoing body does not match bodySchema', async () => {
    global.fetch = makeFetch(201, {});
    await expect(
      apiFetch('/api/travel/trips', { method: 'POST', body: { name: '   ' }, bodySchema: BodySchema }),
    ).rejects.toThrow('Invalid request body');
  });

  it('resolves to undefined for an empty-body success even when responseSchema is set', async () => {
    global.fetch = makeFetch(204, '');
    const data = await apiFetch('/api/travel/trips', {
      method: 'DELETE',
      responseSchema: ResponseSchema,
      silentToast: true,
    });
    expect(data).toBeUndefined();
  });
});
