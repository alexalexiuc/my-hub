import type { FastifyInstance } from 'fastify';

function buildBaseUrl(protocol: string, hostname: string): string {
  return `${protocol}://${hostname}`;
}

function mcpFaviconSvg(): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">',
    '<defs>',
    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0%" stop-color="#0f172a"/>',
    '<stop offset="100%" stop-color="#1d4ed8"/>',
    '</linearGradient>',
    '</defs>',
    '<rect width="64" height="64" rx="12" fill="url(#g)"/>',
    '<path d="M12 44V20h8l8 12 8-12h8v24h-8V32l-8 12-8-12v12h-8z" fill="#f8fafc"/>',
    '</svg>',
  ].join('');
}

export async function publicRoutes(app: FastifyInstance) {
  // OAuth authorization server discovery (RFC 8414)
  app.get('/.well-known/oauth-authorization-server', { logLevel: 'silent' }, async (req, reply) => {
    const base = buildBaseUrl(req.protocol, req.hostname);
    return reply.send({
      issuer: base,
      authorization_endpoint: `${base}/api/authorize`,
      token_endpoint: `${base}/api/token`,
      registration_endpoint: `${base}/api/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  });

  // Protected resource metadata discovery (RFC 9728)
  app.get('/.well-known/oauth-protected-resource', { logLevel: 'silent' }, async (req, reply) => {
    const base = buildBaseUrl(req.protocol, req.hostname);
    return reply.send({
      resource: `${base}/api`,
      authorization_servers: [base],
      bearer_methods_supported: ['header'],
    });
  });

  // Respond directly to browser icon probes.
  app.get('/favicon.ico', { logLevel: 'silent' }, async (_req, reply) => {
    return reply.type('image/svg+xml').send(mcpFaviconSvg());
  });
}
