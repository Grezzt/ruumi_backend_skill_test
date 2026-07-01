import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis';

export const emailQueue = new Queue('email-queue', {
  connection: redisConnection as any
});

export const sendEmailJob = async (to: string, subject: string, content: string) => {
  await emailQueue.add(
    'send-email',
    { to, subject, content },
    {
      attempts: 3, // Fault tolerance: Retry 3
      backoff: {
        type: 'exponential',
        delay: 1000 // Jeda retry akan bertambah (1s, 2s, 4s...)
      },
      removeOnComplete: true,
      removeOnFail: false // Simpan yang gagal untuk keperluan debugging
    }
  );
};
