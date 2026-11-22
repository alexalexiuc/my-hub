import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { putObject } from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env.js';

/**
 * Caveats:
 * - Each daily backup is a full snapshot of the whole notes directory (notes are tiny, so no change detection).
 *   Configure an S3 lifecycle rule on S3_BACKUP_BUCKET (prefix `notes/`) to expire old objects.
 * - Restore: untar into the notes volume (`tar -xzf <file> -C <NOTES_ROOT>`), then run `notes-cli reindex <userId>`
 *   per user, or just restart the mcp container: the index re-syncs changed files at startup.
 */

/**
 * Archives the notes directory (`NOTES_DIR`) as a tar.gz and uploads it to `S3_BACKUP_BUCKET` under
 * `notes/notes-backup-<timestamp>.tar.gz`. Does nothing when `NOTES_DIR`, the bucket or the region is unset,
 * or when the directory is missing or empty.
 */
export async function backupNotesToS3(): Promise<void> {
  const { NOTES_DIR: notesDir, S3_BACKUP_BUCKET: bucketName, AWS_REGION: awsRegion } = workerEnvConfig;

  if (!notesDir || !bucketName || !awsRegion) {
    // Worker is functional but won't back up until all three vars are provided.
    return;
  }

  const entries = await readdir(notesDir).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  if (entries.length === 0) {
    logger.info(`[worker] notes-backup: ${notesDir} is missing or empty, nothing to back up`);
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `notes/notes-backup-${timestamp}.tar.gz`;

  logger.info(`[worker] Starting notes backup → s3://${bucketName}/${key}`);

  const body = await archive(notesDir);

  await putObject({ bucket: bucketName, key, body, contentType: 'application/gzip' });

  logger.info(`[worker] Notes backup complete: s3://${bucketName}/${key} (${body.length} bytes)`);
}

function archive(dir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-czf', '-', '-C', dir, '.']);
    const chunks: Buffer[] = [];

    tar.stderr.on('data', (data: Buffer) => {
      logger.error('[worker] tar:', data.toString().trim());
    });
    tar.on('error', reject);

    tar.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    tar.on('close', code => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`tar exited with code ${code}`));
    });
  });
}
