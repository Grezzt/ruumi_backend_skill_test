import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';

export const emailWorker = new Worker('email-queue', async (job: Job) => {
  const { to, subject, content } = job.data;

  console.log(`[EmailWorker] Processing email delivery to: ${to}`);

  // Railway sometimes injects literal double quotes into the string if copy-pasted incorrectly. We strip them safely here.
  const apiKey = (process.env.BREVO_API_KEY || '').replace(/^"|"$/g, '');
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || '').replace(/^"|"$/g, '');
  const senderName = (process.env.BREVO_SENDER_NAME || '').replace(/^"|"$/g, '');

  if (!apiKey || !senderEmail) {
    throw new Error("Missing Brevo credentials in environment variables.");
  }

  const payload = {
    sender: { name: senderName || 'Ruumi Rental', email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: content,
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Brevo HTTP API responded with ${response.status}: ${errorData}`);
    }

    const data = await response.json();
    console.log(`[EmailWorker] Email successfully sent to: ${to} (MessageId: ${data.messageId})`);
    return { success: true, messageId: data.messageId };
  } catch (error: any) {
    console.error(`[EmailWorker] FAILED to send email to ${to}: ${error.message}`);
    throw error;
  }
}, { connection: redisConnection as any });

emailWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[EmailWorker] Job ${job.id} failed after all retries: ${err.message}`);
  }
});
