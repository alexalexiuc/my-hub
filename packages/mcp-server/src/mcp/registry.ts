import type { SessionManager } from 'fastify-mcp-server';

export interface McpSubServerEntry {
  endpoint: string;
  sessionManager: SessionManager;
}

/**
 * Shared registry of all registered MCP sub-servers.
 * Populated by registerMcpSubServer() during Fastify startup;
 * consumed by sessionCleanupPlugin and monitorRoute after startup.
 */
export const mcpSubServers: McpSubServerEntry[] = [];
