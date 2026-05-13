/**
 * Hub client-side environment configuration.
 *
 * Only NEXT_PUBLIC_* variables may be exported from this file — they are
 * statically inlined by Next.js at build time and safe to include in the
 * browser bundle.
 *
 * Do NOT import `server-only` here. This file is intentionally importable
 * from both Server and Client Components.
 */
export const hubClientEnvConfig = {
  /** Public MCP server URL, used for cross-origin redirect validation. */
  NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL ?? '',
};
