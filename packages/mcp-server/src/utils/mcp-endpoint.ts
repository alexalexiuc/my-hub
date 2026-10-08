/** Returns true for MCP transport endpoints (/api/<name>/mcp). */
export function isMcpEndpoint(url: string): boolean {
  return /\/api\/[^/]+\/mcp(\?|$)/.test(url);
}
