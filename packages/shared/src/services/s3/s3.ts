import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { sharedEnvConfig } from '../../config/env';

function createS3Client(): S3Client {
  return new S3Client({ region: sharedEnvConfig.AWS_REGION });
}

let s3Instance: S3Client | undefined;

function getS3(): S3Client {
  s3Instance ??= createS3Client();
  return s3Instance;
}

export interface PutObjectParams {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * Returns the ETag of an existing S3 object, or null if it does not exist.
 */
export async function getObjectETag({ bucket, key }: { bucket: string; key: string }): Promise<string | null> {
  try {
    const response = await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return response.ETag ?? null;
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NotFound') return null;
    throw err;
  }
}

export async function putObject({ bucket, key, body, contentType }: PutObjectParams): Promise<void> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
