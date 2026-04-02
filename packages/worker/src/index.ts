import 'dotenv-mono/load';
import { startPollLoop } from './poll.js';

console.log('[worker] Starting worker...');
startPollLoop();
