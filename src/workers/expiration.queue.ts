import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis';

export const expirationQueue = new Queue('expiration-queue', {
  connection: redisConnection as any
});

export const scheduleExpirationJob = async (bookingId: string, delayMs: number) => {
  await expirationQueue.add(
    'expire-booking',
    { bookingId },
    {
      delay: delayMs,
      removeOnComplete: true,
      removeOnFail: false
    }
  );
};
