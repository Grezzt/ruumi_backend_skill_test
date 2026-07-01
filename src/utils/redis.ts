import { Redis } from 'ioredis';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisUrl = process.env.REDIS_URL;

// If REDIS_URL is provided (e.g., by Railway), use it. Otherwise, use host/port/password.
export const redisConnection = redisUrl 
  ? new Redis(redisUrl, { maxRetriesPerRequest: null })
  : new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null, // Required by BullMQ for Worker/Queue connection
    });
