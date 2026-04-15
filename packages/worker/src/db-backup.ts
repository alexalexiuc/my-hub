import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import { putObject } from '@my-hub/shared/services';
import { workerEnvConfig } from './config/env';
import { logger } from '@my-hub/shared/utils';

export async function backupDbToS3(): Promise<void> {
  const { DATABASE_URL: databaseUrl, S3_BACKUP_BUCKET: bucketName, AWS_REGION: awsRegion } = workerEnvConfig;

  if (!databaseUrl || !bucketName || !awsRegion) {
    // Worker is functional but won't back up until all three vars are provided.
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `db-backup-${timestamp}.dump.gz`;

  logger.info(`[worker] Starting DB backup → s3://${bucketName}/${key}`);

  const body = await dump(databaseUrl);

  await putObject({ bucket: bucketName, key, body, contentType: 'application/gzip' });

  logger.info(`[worker] DB backup complete: s3://${bucketName}/${key} (${body.length} bytes)`);
}

function dump(databaseUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pgDump = spawn('pg_dump', ['--no-owner', '--no-acl', '--format=c', databaseUrl]);
    const gzip = createGzip();
    const chunks: Buffer[] = [];

    pgDump.stderr.on('data', (data: Buffer) => {
      logger.error('[worker] pg_dump:', data.toString().trim());
    });
    pgDump.on('error', reject);

    gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);

    pgDump.stdout.pipe(gzip);
  });
}
