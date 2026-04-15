import 'dotenv-mono/load';
import { logger } from '@my-hub/shared/utils';
import { startPollLoop } from './poll.js';

logger.info('[worker] Starting worker...');
startPollLoop();
