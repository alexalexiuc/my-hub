import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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
