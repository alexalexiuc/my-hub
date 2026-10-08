import type {
  ReadResourceCallback as SdkReadResourceCallback,
  StandardSchemaWithJSON,
  ToolCallback as SdkToolCallback,
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import { logger, UserInputError } from '@my-hub/shared/utils';
import {
  AnyInput,
  AnyOutput,
  AnyMcpToolDef,
  HubAuthExtra,
  HubAuthInfoLike,
  McpResourceDef,
  McpToolDef,
  ResourceHandler,
  ToolHandler,
  ToolInput,
  RequestExtraParam,
  ZodRawShape,
} from './types';
import { HandledError } from './errors';

export const toolResponse = (payload: unknown) => {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
};

function isStandardSchema(schema: object): schema is StandardSchemaWithJSON {
  return '~standard' in schema;
}

type JsonSchemaConverter = StandardSchemaWithJSON['~standard']['jsonSchema']['input'];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

/** Caches one converter's output per options object (the SDK always passes the same JSON Schema target). */
function memoizeConverter(convert: JsonSchemaConverter): JsonSchemaConverter {
  const cache = new Map<string, Record<string, unknown>>();
  return options => {
    const key = JSON.stringify(options ?? {});
    let json = cache.get(key);
    if (!json) {
      // Frozen: the cached object is shared by every request's McpServer and must never be mutated.
      json = deepFreeze(convert(options));
      cache.set(key, json);
    }
    return json;
  };
}

/**
 * Wraps a schema so its JSON Schema conversion runs once per process instead of once per request.
 *
 * MCP 2026-07-28 HTTP is stateless: the SDK builds a fresh `McpServer` for every request and converts each tool's
 * Zod schema to JSON Schema on `tools/list` / `tools/call` with no cache across instances (~3–6 ms per
 * `tools/list`). Validation still delegates to the original schema, so Zod parsing/transforms are unchanged.
 */
function withCachedJsonSchema(schema: StandardSchemaWithJSON): StandardSchemaWithJSON {
  const standard = schema['~standard'];
  return {
    '~standard': {
      version: standard.version,
      vendor: standard.vendor,
      validate: value => standard.validate(value),
      jsonSchema: {
        input: memoizeConverter(options => standard.jsonSchema.input(options)),
        output: memoizeConverter(options => standard.jsonSchema.output(options)),
      },
    },
  };
}

/**
 * Normalises a tool schema to a cached Standard Schema, once at module load. Raw Zod shapes are wrapped in
 * `z.object()` here instead of by the SDK inside every per-request `McpServer`.
 */
function toStandardSchema(schema: AnyInput | AnyOutput): StandardSchemaWithJSON | undefined {
  if (schema === undefined) return undefined;
  return withCachedJsonSchema(isStandardSchema(schema) ? schema : z.object(schema as ZodRawShape));
}

/**
 * Type-checks schema↔callback alignment at call site, then erases to AnyMcpToolDef for array storage.
 * Schemas are normalised once here so the per-request server factory only registers prebuilt definitions.
 */
export const defineTool = <InputArgs extends AnyInput = undefined, OutputArgs extends AnyOutput = undefined>(
  tool: McpToolDef<InputArgs, OutputArgs>,
): AnyMcpToolDef => ({
  ...(tool as AnyMcpToolDef),
  inputSchema: toStandardSchema(tool.inputSchema),
  outputSchema: toStandardSchema(tool.outputSchema),
});

export const defineResource = (def: McpResourceDef): McpResourceDef => def;

/** Reads the Hub identity that `createHubTokenVerifier` attached to the verified bearer token. */
export function getHubAuthExtra(authInfo?: HubAuthInfoLike): HubAuthExtra | null {
  const { userId, clientId, serverName, email, timezone } = authInfo?.extra || {};

  if (typeof userId !== 'string' || userId.length === 0) return null;
  if (typeof clientId !== 'string' || clientId.length === 0) return null;
  if (typeof serverName !== 'string' || serverName.length === 0) return null;

  return {
    userId,
    email: typeof email === 'string' ? email : undefined,
    clientId,
    serverName: serverName as HubAuthExtra['serverName'],
    timezone: typeof timezone === 'string' ? timezone : null,
  };
}

export function requireHubAuthExtra(extra: RequestExtraParam): HubAuthExtra {
  const authExtra = getHubAuthExtra(extra.http?.authInfo);
  if (!authExtra) {
    throw new HandledError('Authentication required');
  }
  return authExtra;
}

function logMcpError(err: unknown, handlerType: string): void {
  if (err instanceof HandledError || err instanceof UserInputError) {
    logger.warn(`[mcp] ${err.message}`);
  } else {
    logger.error(`[mcp] Unexpected error in ${handlerType}:`, err);
  }
}

export const wrapResourceHandler =
  (cb: ResourceHandler): SdkReadResourceCallback =>
  async (uri, extra) => {
    try {
      const context = requireHubAuthExtra(extra);
      return await cb(uri, context, extra);
    } catch (err) {
      logMcpError(err, 'resource handler');
      throw err;
    }
  };

export const wrapToolHandler = <InputArgs extends AnyInput>(
  cb: ToolHandler<InputArgs>,
): SdkToolCallback<StandardSchemaWithJSON> => {
  return (async (...args: unknown[]) => {
    const input = (args.length === 2 ? args[0] : undefined) as ToolInput<InputArgs>;
    const extra = (args.length === 2 ? args[1] : args[0]) as RequestExtraParam;

    try {
      const context = requireHubAuthExtra(extra);
      return await cb(input, context, extra);
    } catch (err) {
      logMcpError(err, 'tool handler');
      throw err;
    }
  }) as SdkToolCallback<StandardSchemaWithJSON>;
};
