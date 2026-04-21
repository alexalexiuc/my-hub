import { ReadResourceCallback, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AnyInput, AnyOutput, AnyCaloriesToolDef, CaloriesResourceDef, CaloriesToolDef } from './types';

export const toolResponse = (payload: unknown) => {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
};

/** Type-checks schema↔callback alignment at call site, then erases to AnyCaloriesToolDef for array storage */
export const defineTool = <InputArgs extends AnyInput = undefined, OutputArgs extends AnyOutput = undefined>(
  tool: CaloriesToolDef<InputArgs, OutputArgs>,
): AnyCaloriesToolDef => tool as AnyCaloriesToolDef;

export const defineResource = (def: CaloriesResourceDef): CaloriesResourceDef => def;

export const withUserIdCheckResource =
  (cb: ReadResourceCallback): ReadResourceCallback =>
  (uri, extra) => {
    const userId = extra.authInfo?.extra?.userId as string | undefined;
    if (!userId) throw new Error('Authentication required');
    return cb(uri, extra);
  };

export const withUserIdCheck = <InputArgs extends AnyInput>(
  cb: ToolCallback<InputArgs>,
  skipUserIdCheck = false,
): ToolCallback<InputArgs> => {
  return ((...args: unknown[]) => {
    if (skipUserIdCheck) {
      return (cb as (...a: unknown[]) => unknown)(...args);
    }

    // MCP calls either (input, extra) or (extra) for no-input tools.
    const extra = (args.length === 2 ? args[1] : args[0]) as
      | { authInfo?: { extra?: Record<string, unknown> } }
      | undefined;

    const userId = extra?.authInfo?.extra?.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new Error('Authentication required');
    }

    return (cb as (...a: unknown[]) => unknown)(...args);
  }) as ToolCallback<InputArgs>;
};
