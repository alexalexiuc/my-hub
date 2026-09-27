/**
 * Enum-like const object for MCP server names.
 */
export const McpServerNames = {
  Calories: 'calories',
  Finances: 'finances',
  Products: 'products',
  Travel: 'travel',
  Vacation: 'vacation',
} as const;

export type McpServerName = (typeof McpServerNames)[keyof typeof McpServerNames];
