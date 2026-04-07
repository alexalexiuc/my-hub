/**
 * Enum-like const object for MCP server names.
 */
export const McpServerName = {
  Apiary: 'apiary',
  Calories: 'calories',
  Products: 'products',
  Travel: 'travel',
  Todo: 'todo',
} as const;

export type McpServerName = (typeof McpServerName)[keyof typeof McpServerName];
export const mcpServerNameValues = [
  McpServerName.Apiary,
  McpServerName.Calories,
  McpServerName.Products,
  McpServerName.Travel,
  McpServerName.Todo,
] as const;
