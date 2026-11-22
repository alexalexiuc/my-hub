import type { FastifyInstance } from 'fastify';
import { verifyToken } from '@my-hub/shared/auth';
import { NOTES_DELETE_ALL_PATH, NOTES_DELETE_ALL_PURPOSE } from '@my-hub/shared/constants';
import { logger } from '@my-hub/shared/utils';
import { envConfig } from '../config/env.js';
import { deleteNotesOf, notesConfigured } from './runtime.js';

/**
 * Internal routes the Hub calls server to server. Notes live only here (files + their index), so the Hub's
 * "Delete all my data" cannot reach them through the shared services.
 */
export async function notesInternalRoutes(app: FastifyInstance) {
  app.post(NOTES_DELETE_ALL_PATH, async (req, reply) => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
    const payload = token
      ? await verifyToken<{ userId?: string; purpose?: string }>(token, envConfig.NEXTAUTH_SECRET)
      : null;
    if (!payload?.userId || payload.purpose !== NOTES_DELETE_ALL_PURPOSE) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    if (!notesConfigured()) return { deleted: false, reason: 'notes are not configured on this server' };

    await deleteNotesOf(payload.userId);
    logger.info(`[notes] deleted all notes of user ${payload.userId}`);
    return { deleted: true };
  });
}
