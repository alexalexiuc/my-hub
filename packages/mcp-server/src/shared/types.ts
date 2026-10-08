import type {
  AuthInfo,
  CallToolResult,
  ReadResourceCallback as SdkReadResourceCallback,
  ServerContext,
  ToolCallback as SdkToolCallback,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { McpServerName } from '@my-hub/shared/constants';

/** A tool schema: a Standard Schema, or a raw Zod shape (`Schema.shape`) wrapped into `z.object()` at definition. */
export type AnyInput = undefined | z.ZodRawShape | StandardSchemaWithJSON;
export type AnyOutput = AnyInput;

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

export type ToolInput<InputArgs extends AnyInput = undefined> = InputArgs extends z.ZodRawShape
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
 * Type-erased, registration-ready tool: schemas are normalised to Standard Schemas and the handler is wrapped,
 * both once at module load, so the per-request server factory does no schema or wrapping work.
 */
export type AnyMcpToolDef = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: StandardSchemaWithJSON;
  outputSchema?: StandardSchemaWithJSON;
  annotations?: ToolAnnotations;
  handler: SdkToolCallback<StandardSchemaWithJSON>;
};

/** Registration-ready resource: the handler is wrapped once at module load. */
export type RegisteredResourceDef = Omit<McpResourceDef, 'callback'> & { handler: SdkReadResourceCallback };
