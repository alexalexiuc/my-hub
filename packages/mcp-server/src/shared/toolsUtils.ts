import {
  ReadResourceCallback as SdkReadResourceCallback,
  ToolCallback as SdkToolCallback,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AnyInput,
  AnyOutput,
  AnyMcpToolDef,
  HubAuthExtra,
  HubRequestExtra,
  McpResourceDef,
  McpToolDef,
  ResourceHandler,
  ToolHandler,
  ToolInput,
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

type RawRequestExtra =
  | {
      authInfo?: {
        extra?: Record<string, unknown>;
      };
    }
  | HubRequestExtra
  | undefined;

export function getHubAuthExtra(extra: RawRequestExtra): HubAuthExtra | null {
  const authExtra = extra?.authInfo?.extra;
  const userId = authExtra?.userId;
  const clientId = authExtra?.clientId;
  const serverName = authExtra?.serverName;

  if (typeof userId !== 'string' || userId.length === 0) return null;
  if (typeof clientId !== 'string' || clientId.length === 0) return null;
  if (typeof serverName !== 'string' || serverName.length === 0) return null;

  return {
    userId,
    email: typeof authExtra?.email === 'string' ? authExtra.email : undefined,
    clientId,
    serverName: serverName as HubAuthExtra['serverName'],
    timezone: typeof authExtra?.timezone === 'string' ? authExtra.timezone : null,
  };
}

export function requireHubAuthExtra(extra: RawRequestExtra): HubAuthExtra {
  const authExtra = getHubAuthExtra(extra);
  if (!authExtra) {
    throw new Error('Authentication required');
  }
  return authExtra;
}

export const toSdkReadResourceCallback = (cb: ResourceHandler): SdkReadResourceCallback => {
  return (uri, extra) => cb(uri, extra as HubRequestExtra);
};

export const withUserIdCheckResource =
  (cb: ResourceHandler): SdkReadResourceCallback =>
  (uri, extra) => {
    requireHubAuthExtra(extra);
    return cb(uri, extra as HubRequestExtra);
  };

export const withUserIdCheck = <InputArgs extends AnyInput>(
  cb: ToolHandler<InputArgs>,
  skipUserIdCheck = false,
): SdkToolCallback<InputArgs> => {
  return ((...args: unknown[]) => {
    const input = (args.length === 2 ? args[0] : undefined) as ToolInput<InputArgs>;
    const extra = (args.length === 2 ? args[1] : args[0]) as RawRequestExtra;

    if (skipUserIdCheck) {
      return cb(input, extra as HubRequestExtra);
    }

    requireHubAuthExtra(extra);

    return cb(input, extra as HubRequestExtra);
  }) as SdkToolCallback<InputArgs>;
};
