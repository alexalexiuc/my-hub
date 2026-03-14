import type { FastifyInstance } from 'fastify';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createCaloriesServer } from '../calories/server';
import { mcpAuthHandler } from '../auth';

/**
 * MCP router — one static route per MCP sub-server.
 *
 * All routes require Bearer token auth via mcpAuthHandler.
 * userId is extracted from the verified token payload (req.mcpUserId).
 *
 * Stateless mode (no sessionIdGenerator) — each POST is independent.
 */
export async function mcpRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => {
    return reply.send({
      message: 'MCP endpoint',
      servers: ['calories'],
    });
  });

  app.post('/calories', { preHandler: mcpAuthHandler }, async (req, reply) => {
    const server = createCaloriesServer(req.mcpUserId);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      const protocol = req.protocol ?? 'http';
      const host = (req.headers.host as string | undefined) ?? req.hostname;
      const webRequest = new Request(`${protocol}://${host}${req.url}`, {
        method: req.method,
        headers: buildHeaders(req.headers),
        body: req.body != null ? JSON.stringify(req.body) : null,
      });

      const webResponse = await transport.handleRequest(webRequest);

      reply.status(webResponse.status);
      webResponse.headers.forEach((value, key) => {
        void reply.header(key, value);
      });
      return reply.send(await webResponse.text());
    } finally {
      await server.close().catch((err: unknown) => {
        app.log.warn({ err }, 'Failed to close calories MCP server cleanly');
      });
    }
  });
}

function buildHeaders(raw: Record<string, string | string[] | undefined>): Headers {
  const headers = new Headers();
  for (const [key, val] of Object.entries(raw)) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      for (const v of val) headers.append(key, v);
    } else {
      headers.set(key, val);
    }
  }
  return headers;
}
