import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';
import { findOAuthClient } from '@my-hub/shared/services';
import { verifyToken, type McpTokenPayload } from '@my-hub/shared/auth';

// Augment the Fastify request type to carry the resolved userId
declare module 'fastify' {
  interface FastifyRequest {
    mcpUserId: string;
  }
}

/**
 * Fastify preHandler that validates a Bearer token and attaches
 * the resolved userId to `req.mcpUserId`.
 *
 * Steps:
 *  1. Read Authorization: Bearer <token>
 *  2. Decode payload (without HMAC verify) to extract client_id
 *  3. SELECT tokenSigningSecret FROM oauth_clients WHERE client_id = ?
 *  4. verifyToken<McpTokenPayload>(token, tokenSigningSecret)
 *  5. Attach req.mcpUserId = payload.user_id
 */
export async function mcpAuthHandler(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return reply.status(401).header('WWW-Authenticate', 'Bearer').send({ error: 'missing_token' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return reply.status(401).header('WWW-Authenticate', 'Bearer').send({ error: 'invalid_token' });
  }

  // Decode payload without verifying — just to get client_id for key lookup
  const dot = token.indexOf('.');
  if (dot === -1) {
    return reply.status(401).send({ error: 'invalid_token' });
  }
  let rawPayload: McpTokenPayload;
  try {
    const decoded = Buffer.from(token.slice(0, dot).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    rawPayload = JSON.parse(decoded) as McpTokenPayload;
  } catch {
    return reply.status(401).send({ error: 'invalid_token' });
  }

  const clientId = rawPayload.client_id;
  if (!clientId) {
    return reply.status(401).send({ error: 'invalid_token' });
  }

  const client = await findOAuthClient(clientId);
  if (!client) {
    return reply.status(401).send({ error: 'invalid_client' });
  }

  const payload = await verifyToken<McpTokenPayload>(token, client.tokenSigningSecret);
  if (!payload) {
    return reply.status(401).send({ error: 'invalid_token' });
  }

  req.mcpUserId = payload.user_id;
}

/**
 * Fastify plugin that decorates the request with `mcpUserId`.
 * Register this before routes that need it.
 */
export const mcpAuthPlugin: FastifyPluginCallback = (fastify: FastifyInstance, _opts, done) => {
  fastify.decorateRequest('mcpUserId', '');
  done();
};
