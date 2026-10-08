import type {
  AuthInfo,
  CallToolResult,
  ReadResourceCallback as SdkReadResourceCallback,
  ServerContext,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { McpServerName } from '@my-hub/shared/constants';

/** Raw Zod object shape (`Schema.shape`) — wrapped into `z.object()` once, at definition time. */
export type ZodRawShape = z.ZodRawShape;

export type AnyInput = undefined | ZodRawShape | StandardSchemaWithJSON;
export type AnyOutput = undefined | ZodRawShape | StandardSchemaWithJSON;

/** Exact per-request context passed by SDK tool/resource callbacks. */
export type RequestExtraParam = ServerContext;

/** Minimal auth-bearing shape accepted by auth helper utilities and logging hooks. */
export type HubAuthInfoLike = Pick<AuthInfo, 'extra'> | undefined;

export type HubAuthExtra = {
  userId: string;
  email?: string;
  clientId: string;
  serverName: McpServerName;
  timezone: string | null;
};

export type ToolInput<InputArgs extends AnyInput = undefined> = InputArgs extends ZodRawShape
  ? z.output<z.ZodObject<InputArgs>>
  : InputArgs extends StandardSchemaWithJSON
    ? StandardSchemaWithJSON.InferOutput<InputArgs>
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

/**
 * Type-erased, registration-ready tool: schemas are already normalised to Standard Schemas
 * (built once at module load) so per-request server construction does no schema work.
 */
export type AnyMcpToolDef = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: StandardSchemaWithJSON;
  outputSchema?: StandardSchemaWithJSON;
  annotations?: ToolAnnotations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: ToolHandler<any>;
};
