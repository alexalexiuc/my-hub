import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function createS3Client(): S3Client {
  const region = process.env['AWS_REGION'];
  if (!region) throw new Error('AWS_REGION environment variable is required');
  return new S3Client({ region });
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
