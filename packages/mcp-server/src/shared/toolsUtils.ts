import {
  ReadResourceCallback as SdkReadResourceCallback,
  ToolCallback as SdkToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
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
    throw new Error('Authentication required');
  }
  return authExtra;
}

export const withUserIdCheckResource =
  (cb: ResourceHandler): SdkReadResourceCallback =>
  (uri, extra) => {
    const context = requireHubAuthExtra(extra);
    return cb(uri, context, extra);
  };

export const withUserIdCheck = <InputArgs extends AnyInput>(cb: ToolHandler<InputArgs>): SdkToolCallback<InputArgs> => {
  return ((...args: unknown[]) => {
    const input = (args.length === 2 ? args[0] : undefined) as ToolInput<InputArgs>;
    const extra = (args.length === 2 ? args[1] : args[0]) as RequestExtraParam;

    const context = requireHubAuthExtra(extra);

    return cb(input, context, extra);
  }) as SdkToolCallback<InputArgs>;
};
