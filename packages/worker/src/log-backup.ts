import { createReadStream, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { createGzip } from 'zlib';
import { putObject } from '@my-hub/shared/services';
import { logger } from '@my-hub/shared/utils';
import { workerEnvConfig } from './config/env.js';

/**
 * Caveats:
 * - Logs from containers removed during a redeploy are lost before backup runs.
 * - Each daily backup is a full snapshot. Configure an S3 lifecycle rule on S3_LOGS_BUCKET
 *   to expire objects after the desired retention period.
 */

/** Reads the container name from config.v2.json, e.g. "/my-hub-prod-worker-1" → "my-hub-prod-worker-1". */
function readContainerName(containerDir: string, fallback: string): string {
  try {
    const raw = readFileSync(join(containerDir, 'config.v2.json'), 'utf8');
    const config = JSON.parse(raw) as { Name?: string };
    const name = config.Name?.replace(/^\//, '').trim();
    return name || fallback;
  } catch {
    return fallback;
  }
}

export async function backupLogsToS3(): Promise<void> {
  const bucketName = workerEnvConfig.S3_LOGS_BUCKET;
  const awsRegion = workerEnvConfig.AWS_REGION;

  if (!bucketName || !awsRegion) {
    // Worker is functional but won't back up until S3_LOGS_BUCKET and AWS_REGION are provided.
    return;
  }

  let containerIds: string[];
  try {
    containerIds = readdirSync(workerEnvConfig.DOCKER_LOGS_DIR);
  } catch (err) {
    logger.error('[log-backup] Cannot read Docker log directory:', err);
    return;
  }

  const datePrefix = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let uploaded = 0;
  let skipped = 0;

  for (const containerId of containerIds) {
    const containerDir = join(workerEnvConfig.DOCKER_LOGS_DIR, containerId);
    const containerName = readContainerName(containerDir, containerId.slice(0, 12));

    // Collect the active log file plus any rotated files (.log.1, .log.2, …).
    let logFiles: string[];
    try {
      logFiles = readdirSync(containerDir)
        .filter((f) => f.startsWith(`${containerId}-json.log`))
        .sort(); // lexicographic: .log < .log.1 < .log.2 (active file sorts first)
    } catch {
      skipped++;
      continue;
    }

    for (const logFileName of logFiles) {
      const logFile = join(containerDir, logFileName);

      try {
        const stat = statSync(logFile);
        if (!stat.isFile() || stat.size === 0) {
          skipped++;
          continue;
        }
      } catch {
        skipped++;
        continue;
      }

      try {
        const body = await compress(logFile);
        // Suffix distinguishes rotated files: .log → "", .log.1 → ".1", etc.
        const rotationSuffix = logFileName.replace(`${containerId}-json.log`, '');
        const key = `logs/${datePrefix}/${containerName}${rotationSuffix}.log.gz`;
        await putObject({ bucket: bucketName, key, body, contentType: 'application/gzip' });
        logger.info(`[log-backup] Uploaded ${key} (${body.length} bytes)`);
        uploaded++;
      } catch (err) {
        logger.error(`[log-backup] Failed for ${containerName}:`, err);
      }
    }
  }

  logger.info(`[log-backup] Done — uploaded: ${uploaded}, skipped: ${skipped}`);
}

function compress(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const gzip = createGzip();
    const chunks: Buffer[] = [];

    gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
    stream.on('error', reject);

    stream.pipe(gzip);
  });
}
