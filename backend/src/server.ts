import { createApp } from './app';
import { config } from './config/env';
import { logger } from './config/logger';

const app = createApp();

app.listen(config.port, () => {
  logger.info(`[Server] CertiFlow API Server running at http://localhost:${config.port}`);
  logger.info(`[Server] Environment: ${config.nodeEnv}`);
});
