/**
 * Enum-like const object for MCP server names.
 */
export const McpServerNames = {
  Apiary: 'apiary',
  Calories: 'calories',
  Finances: 'finances',
  Products: 'products',
  Travel: 'travel',
  Todo: 'todo',
} as const;

export type McpServerName = (typeof McpServerNames)[keyof typeof McpServerNames];
