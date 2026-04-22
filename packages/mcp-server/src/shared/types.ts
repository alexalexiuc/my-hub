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

/** Exact extra object passed by SDK tool/resource callbacks. */
export type RequestExtraParam = Parameters<SdkReadResourceCallback>[1];

/** Minimal auth-bearing shape accepted by auth helper utilities and logging hooks. */
export type HubExtraParam = {
  authInfo?: {
    extra?: {
      userId?: unknown;
      email?: unknown;
      clientId?: unknown;
      serverName?: unknown;
      timezone?: unknown;
    };
  };
};

export type HubAuthExtra = {
  userId: string;
  email?: string;
  clientId: string;
  serverName: McpServerName;
  timezone: string | null;
};

export type ToolInput<InputArgs extends AnyInput = undefined> = InputArgs extends ZodRawShapeCompat
  ? ShapeOutput<InputArgs>
  : InputArgs extends AnySchema
    ? SchemaOutput<InputArgs>
    : undefined;

export type ToolHandler<InputArgs extends AnyInput = undefined> = (
  input: ToolInput<InputArgs>,
  context: HubAuthExtra,
  extra?: RequestExtraParam,
) => CallToolResult | Promise<CallToolResult>;

export type ResourceHandler = (
  uri: Parameters<SdkReadResourceCallback>[0],
  context: HubAuthExtra,
  extra?: RequestExtraParam,
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
};

export type McpResourceDef = {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
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
};
