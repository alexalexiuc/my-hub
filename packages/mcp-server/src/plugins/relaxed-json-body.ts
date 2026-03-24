import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

const JSON_CONTENT_TYPE = 'application/json';

async function relaxedJsonBodyPlugin(app: FastifyInstance) {
  if (app.hasContentTypeParser(JSON_CONTENT_TYPE)) {
    app.removeContentTypeParser(JSON_CONTENT_TYPE);
  }

  const defaultJsonParser = app.getDefaultJsonParser('error', 'error');

  app.addContentTypeParser(JSON_CONTENT_TYPE, { parseAs: 'string' }, (req, body, done) => {
    const rawBody = typeof body === 'string' ? body : body.toString('utf8');

    if (rawBody.length === 0) {
      done(null, null);
      return;
    }

    defaultJsonParser(req, rawBody, done);
  });
}

export default fp(relaxedJsonBodyPlugin, { name: 'relaxed-json-body' });
