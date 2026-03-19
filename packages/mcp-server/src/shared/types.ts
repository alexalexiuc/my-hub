import { ReadResourceCallback, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AnySchema, ZodRawShapeCompat } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export type AnyInput = undefined | ZodRawShapeCompat | AnySchema;
export type AnyOutput = undefined | ZodRawShapeCompat | AnySchema;

/** Per-tool fully-typed definition — used inside defineTool for compile-time safety */
export type CaloriesToolDef<InputArgs extends AnyInput = undefined, OutputArgs extends AnyOutput = undefined> = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: InputArgs;
  outputSchema?: OutputArgs;
  annotations?: ToolAnnotations;
  callback: ToolCallback<InputArgs>;
  skipUserIdCheck?: boolean;
};

export type CaloriesResourceDef = {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
  skipUserIdCheck?: boolean;
  callback: ReadResourceCallback;
};

/** Type-erased alias for storing mixed-schema tools in a single array */
export type AnyCaloriesToolDef = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: AnyInput;
  outputSchema?: AnyOutput;
  annotations?: ToolAnnotations;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callback: ToolCallback<any>;
  skipUserIdCheck?: boolean;
};
