import pino from 'pino';
import { config } from './env';

export const logger = pino({
  level: process.env.LOG_LEVEL || (config.nodeEnv === 'test' ? 'silent' : 'info'),
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
