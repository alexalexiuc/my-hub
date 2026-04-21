import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { ReadResourceCallback as SdkReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AnySchema,
  SchemaOutput,
  ShapeOutput,
  ZodRawShapeCompat,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { McpServerName } from '@my-hub/shared/constants';

export type AnyInput = undefined | ZodRawShapeCompat | AnySchema;
export type AnyOutput = undefined | ZodRawShapeCompat | AnySchema;

export type HubAuthExtra = {
  userId: string;
  email?: string;
  clientId: string;
  serverName: McpServerName;
  timezone: string | null;
};

type SdkRequestExtra = Parameters<SdkReadResourceCallback>[1];

export type HubRequestExtra = Omit<SdkRequestExtra, 'authInfo'> & {
  authInfo?: Omit<AuthInfo, 'extra'> & {
    extra?: HubAuthExtra;
  };
};

export type ToolInput<InputArgs extends AnyInput = undefined> = InputArgs extends ZodRawShapeCompat
  ? ShapeOutput<InputArgs>
  : InputArgs extends AnySchema
    ? SchemaOutput<InputArgs>
    : undefined;

export type ToolHandler<InputArgs extends AnyInput = undefined> = (
  input: ToolInput<InputArgs>,
  extra: HubRequestExtra,
) => CallToolResult | Promise<CallToolResult>;

export type ResourceHandler = (
  uri: Parameters<SdkReadResourceCallback>[0],
  extra: HubRequestExtra,
) => ReturnType<SdkReadResourceCallback>;

/** Per-tool fully-typed definition — used inside defineTool for compile-time safety */
export type McpToolDef<InputArgs extends AnyInput = undefined, OutputArgs extends AnyOutput = undefined> = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: InputArgs;
  outputSchema?: OutputArgs;
  annotations?: ToolAnnotations;
  callback: ToolHandler<InputArgs>;
  skipUserIdCheck?: boolean;
};

export type McpResourceDef = {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
  skipUserIdCheck?: boolean;
  callback: ResourceHandler;
};

/** Type-erased alias for storing mixed-schema tools in a single array */
export type AnyMcpToolDef = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: AnyInput;
  outputSchema?: AnyOutput;
  annotations?: ToolAnnotations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: ToolHandler<any>;
  skipUserIdCheck?: boolean;
};
