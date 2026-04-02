import { SESClient } from '@aws-sdk/client-ses';

let sesInstance: SESClient | undefined;

export function getSesClient(): SESClient {
  if (!sesInstance) {
    const region = process.env['AWS_REGION'];
    if (!region) throw new Error('AWS_REGION environment variable is required');
    sesInstance = new SESClient({ region });
  }
  return sesInstance;
}
