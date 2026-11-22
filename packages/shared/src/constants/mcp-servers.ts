/**
 * Enum-like const object for MCP server names.
 */
export const McpServerNames = {
  Calories: 'calories',
  Finances: 'finances',
  Notes: 'notes',
  Products: 'products',
  Travel: 'travel',
  Vacation: 'vacation',
} as const;

export type McpServerName = (typeof McpServerNames)[keyof typeof McpServerNames];

/**
 * Internal mcp-server endpoint the Hub's "Delete all my data" calls to wipe the user's notes (Markdown files, git
 * history and index rows), which live only on the mcp-server. Authenticated with a short-lived JWT signed with
 * NEXTAUTH_SECRET whose `purpose` is `NOTES_DELETE_ALL_PURPOSE`.
 */
export const NOTES_DELETE_ALL_PATH = '/api/notes/delete-all';
export const NOTES_DELETE_ALL_PURPOSE = 'notes-delete-all';
