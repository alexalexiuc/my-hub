import type { McpServerName } from '@my-hub/shared/constants';

/** Request counters kept by fastify-mcp-server's HTTP host for one endpoint. */
export interface McpEndpointStats {
  requestsTotal: number;
  inFlightRequests: number;
  errorsTotal: number;
}

export interface McpSubServerEntry {
  endpoint: string;
  serverName: McpServerName;
  getStats: () => McpEndpointStats;
}

/**
 * Shared registry of all registered MCP sub-servers.
 * Populated by registerMcpSubServer() during Fastify startup;
 * consumed by monitorRoute after startup.
 */
export const mcpSubServers: McpSubServerEntry[] = [];
