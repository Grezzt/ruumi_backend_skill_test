import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';
import nodemailer from 'nodemailer';

export const emailWorker = new Worker('email-queue', async (job: Job) => {
  const { to, subject, content } = job.data;

  console.log(`[EmailWorker] Memproses pengiriman email ke: ${to}`);

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
    console.log(`[EmailWorker] Email sukses terkirim ke: ${to} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[EmailWorker] GAGAL mengirim email ke ${to}: ${error.message}`);
    throw error; // Throw error akan memicu mekanisme Retry otomatis dari BullMQ
  }
}, { connection: redisConnection as any });

emailWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[EmailWorker] Job ${job.id} gagal setelah semua percobaan retry: ${err.message}`);
  }
});
