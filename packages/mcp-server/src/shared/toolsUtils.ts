import {
  ReadResourceCallback as SdkReadResourceCallback,
  ToolCallback as SdkToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '@my-hub/shared/utils';
import {
  AnyInput,
  AnyOutput,
  AnyMcpToolDef,
  HubAuthExtra,
  McpResourceDef,
  McpToolDef,
  ResourceHandler,
  ToolHandler,
  ToolInput,
  RequestExtraParam,
  HubExtraParam,
} from './types';
import { HandledError } from './errors';

export const toolResponse = (payload: unknown) => {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
};

/** Type-checks schema↔callback alignment at call site, then erases to AnyMcpToolDef for array storage */
export const defineTool = <InputArgs extends AnyInput = undefined, OutputArgs extends AnyOutput = undefined>(
  tool: McpToolDef<InputArgs, OutputArgs>,
): AnyMcpToolDef => tool as AnyMcpToolDef;

export const defineResource = (def: McpResourceDef): McpResourceDef => def;

export function getHubAuthExtra(extra?: HubExtraParam): HubAuthExtra | null {
  const { userId, clientId, serverName, email, timezone } = extra?.authInfo?.extra || {};

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
  const authExtra = getHubAuthExtra(extra);
  if (!authExtra) {
    throw new HandledError('Authentication required');
  }
  return authExtra;
}

function logMcpError(err: unknown, handlerType: string): void {
  if (err instanceof HandledError) {
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

export const wrapToolHandler = <InputArgs extends AnyInput>(cb: ToolHandler<InputArgs>): SdkToolCallback<InputArgs> => {
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
  }) as SdkToolCallback<InputArgs>;
};
