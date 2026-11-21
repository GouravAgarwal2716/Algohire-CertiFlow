import Redis from 'ioredis';
import { config } from './env';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

export const redisSub = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const redisPub = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('error', (err) => {
  if (config.nodeEnv !== 'test') {
    console.error('[Redis Error]', err.message);
  }
});
