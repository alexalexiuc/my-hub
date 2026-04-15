import { SESClient } from '@aws-sdk/client-ses';
import { sharedEnvConfig } from '../../config/env';

let sesInstance: SESClient | undefined;

export function getSesClient(): SESClient {
  if (!sesInstance) {
    sesInstance = new SESClient({ region: sharedEnvConfig.AWS_REGION });
  }
  return sesInstance;
}
