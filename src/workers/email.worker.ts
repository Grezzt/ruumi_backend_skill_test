import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';
import nodemailer from 'nodemailer';

export const emailWorker = new Worker('email-queue', async (job: Job) => {
  const { to, subject, content } = job.data;

  console.log(`[EmailWorker] Processing email delivery to: ${to}`);

  const smtpUser = process.env.BREVO_SMTP_USER;
  const smtpPass = process.env.BREVO_SMTP_PASSWORD;

  const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST,
    port: parseInt(process.env.BREVO_SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: `"${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`,
    to,
    subject,
    html: content,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailWorker] Email successfully sent to: ${to} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EmailWorker] FAILED to send email to ${to}: ${error.message}`);
    throw error; // Throwing error will trigger BullMQ automatic retry mechanism
  }
}, { connection: redisConnection as any });

emailWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[EmailWorker] Job ${job.id} failed after all retries: ${err.message}`);
  }
});
