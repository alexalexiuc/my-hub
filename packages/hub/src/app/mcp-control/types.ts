import type { McpServerName } from '@my-hub/shared/constants';

export interface McpServerRow {
  id: number;
  serverName: McpServerName;
  enabled: boolean;
  createdAt: string;
}

export interface OAuthClientRow {
  id: number;
  clientId: string;
  clientName: string | null;
  redirectUris: string[];
  enabled: boolean;
  userId: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  lastUsedPath?: string | null;
}

export interface CreatedClient extends OAuthClientRow {
  plainClientSecret: string;
}

export interface LogEntry {
  id: number;
  service: string;
  server: string | null;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
  requestBody: Record<string, unknown> | null;
  responseBody: Record<string, unknown> | null;
  error: string | null;
}
