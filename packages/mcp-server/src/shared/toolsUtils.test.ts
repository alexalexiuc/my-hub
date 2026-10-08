import { describe, expect, it, vi } from 'vitest';
import { McpServerNames } from '@my-hub/shared/constants';
import { z } from 'zod';
import type { HubAuthInfoLike, RequestExtraParam, ResourceHandler, ToolHandler } from './types';
import {
  defineTool,
  getHubAuthExtra,
  requireHubAuthExtra,
  toolResponse,
  wrapToolHandler,
  wrapResourceHandler,
} from './toolsUtils';

function buildExtra(
  overrides?: Partial<Record<'userId' | 'email' | 'clientId' | 'serverName' | 'timezone', unknown>>,
): HubAuthInfoLike {
  return {
    extra: {
      userId: 'user-1',
      email: 'user@example.com',
      clientId: 'client-1',
      serverName: McpServerNames.Calories,
      timezone: 'Europe/Bucharest',
      ...overrides,
    },
  };
}

function buildRequestExtra(
  overrides?: Partial<Record<'userId' | 'email' | 'clientId' | 'serverName' | 'timezone', unknown>>,
): RequestExtraParam {
  return { http: { authInfo: buildExtra(overrides) } } as RequestExtraParam;
}

describe('toolResponse', () => {
  it('wraps payload as a single MCP text content block', () => {
    const result = toolResponse({ ok: true, count: 2 });

    expect(result).toEqual({
      content: [{ type: 'text', text: '{"ok":true,"count":2}' }],
    });
  });
});

describe('defineTool', () => {
  const jsonOptions = { target: 'draft-2020-12' } as const;

  it('wraps a raw zod shape into an object schema that validates with zod', async () => {
    const tool = defineTool({
      name: 't',
      inputSchema: { tripId: z.coerce.number() },
      callback: async () => toolResponse({}),
    });
    const standard = tool.inputSchema!['~standard'];

    expect(await standard.validate({ tripId: '7' })).toEqual({ value: { tripId: 7 } });
    expect(await standard.validate({})).toHaveProperty('issues');
    expect(standard.jsonSchema.input(jsonOptions)).toMatchObject({ type: 'object', required: ['tripId'] });
    expect(tool.outputSchema).toBeUndefined();
  });

  it('keeps standard schema refinements', async () => {
    const schema = z.object({ tripId: z.number() }).strict();
    const tool = defineTool({ name: 't', inputSchema: schema, callback: async () => toolResponse({}) });

    expect(await tool.inputSchema!['~standard'].validate({ tripId: 1, extra: true })).toHaveProperty('issues');
  });

  it('converts to JSON Schema once and returns the same frozen object afterwards', () => {
    const schema = z.object({ tripId: z.number() });
    const convert = vi.spyOn(schema['~standard'].jsonSchema, 'input');
    const tool = defineTool({ name: 't', inputSchema: schema, callback: async () => toolResponse({}) });
    const { jsonSchema } = tool.inputSchema!['~standard'];

    const first = jsonSchema.input(jsonOptions);
    const second = jsonSchema.input({ ...jsonOptions });

    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(convert).toHaveBeenCalledOnce();
  });
});

describe('getHubAuthExtra', () => {
  it('returns null when no auth-bearing extra is provided', () => {
    expect(getHubAuthExtra()).toBeNull();
  });

  it('returns parsed auth extra for a valid payload', () => {
    const result = getHubAuthExtra(buildExtra());

    expect(result).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      clientId: 'client-1',
      serverName: McpServerNames.Calories,
      timezone: 'Europe/Bucharest',
    });
  });

  it('normalizes non-string optional fields', () => {
    const result = getHubAuthExtra(
      buildExtra({
        email: 123,
        timezone: 456,
      }),
    );

    expect(result).toEqual({
      userId: 'user-1',
      email: undefined,
      clientId: 'client-1',
      serverName: McpServerNames.Calories,
      timezone: null,
    });
  });

  it('returns null when required fields are missing/invalid', () => {
    expect(getHubAuthExtra(buildExtra({ userId: '' }))).toBeNull();
    expect(getHubAuthExtra(buildExtra({ clientId: '' }))).toBeNull();
    expect(getHubAuthExtra(buildExtra({ serverName: '' }))).toBeNull();
  });
});

describe('requireHubAuthExtra', () => {
  it('returns auth extra for valid payload', () => {
    expect(requireHubAuthExtra(buildRequestExtra())).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      clientId: 'client-1',
      serverName: McpServerNames.Calories,
      timezone: 'Europe/Bucharest',
    });
  });

  it('throws when auth is missing required fields', () => {
    expect(() => requireHubAuthExtra(buildRequestExtra({ userId: '' }))).toThrow('Authentication required');
  });
});

describe('wrapResourceHandler', () => {
  it('injects context and forwards uri+extra', async () => {
    const cb: ResourceHandler = vi.fn(async uri => ({
      contents: [{ uri: String(uri), mimeType: 'application/json', text: '{}' }],
    }));

    const wrapped = wrapResourceHandler(cb);
    const extra = buildRequestExtra();
    const uri = new URL('travel://trips');

    await wrapped(uri, extra);

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(
      uri,
      {
        userId: 'user-1',
        email: 'user@example.com',
        clientId: 'client-1',
        serverName: McpServerNames.Calories,
        timezone: 'Europe/Bucharest',
      },
      extra,
    );
  });

  it('rejects when auth is invalid', async () => {
    const cb: ResourceHandler = vi.fn(async () => ({ contents: [] }));
    const wrapped = wrapResourceHandler(cb);
    const uri = new URL('travel://trips');

    await expect(wrapped(uri, buildRequestExtra({ userId: '' }))).rejects.toThrow('Authentication required');
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('wrapToolHandler', () => {
  it('supports two-argument sdk callback style (input, ctx)', async () => {
    const cb: ToolHandler = vi.fn(async () => toolResponse({ ok: true }));
    const wrapped = wrapToolHandler(cb);
    const extra = buildRequestExtra();
    const input = { tripId: 7 };

    await (wrapped as unknown as (inputArg: unknown, extraArg: RequestExtraParam) => Promise<unknown>)(input, extra);

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(
      input,
      {
        userId: 'user-1',
        email: 'user@example.com',
        clientId: 'client-1',
        serverName: McpServerNames.Calories,
        timezone: 'Europe/Bucharest',
      },
      extra,
    );
  });

  it('supports single-argument sdk callback style (ctx only)', async () => {
    const cb: ToolHandler<undefined> = vi.fn(async () => toolResponse({ ok: true }));
    const wrapped = wrapToolHandler(cb);
    const extra = buildRequestExtra();

    await (wrapped as unknown as (extraArg: RequestExtraParam) => Promise<unknown>)(extra);

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(
      undefined,
      {
        userId: 'user-1',
        email: 'user@example.com',
        clientId: 'client-1',
        serverName: McpServerNames.Calories,
        timezone: 'Europe/Bucharest',
      },
      extra,
    );
  });

  it('rejects when auth is invalid', async () => {
    const cb: ToolHandler = vi.fn(async () => toolResponse({ ok: true }));
    const wrapped = wrapToolHandler(cb);

    await expect(
      (wrapped as unknown as (extraArg: RequestExtraParam) => Promise<unknown>)(buildRequestExtra({ userId: '' })),
    ).rejects.toThrow('Authentication required');
    expect(cb).not.toHaveBeenCalled();
  });
});
