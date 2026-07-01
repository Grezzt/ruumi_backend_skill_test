import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';
import { prisma } from '../utils/db';
import { sendEmailJob } from './email.queue';

export const expirationWorker = new Worker('expiration-queue', async (job: Job) => {
  const { bookingId } = job.data;
  console.log(`[ExpirationWorker] Memeriksa kedaluwarsa untuk Booking ID: ${bookingId}`);

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const booking = await tx.bookingRequest.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      console.warn(`[ExpirationWorker] Booking ID ${bookingId} tidak ditemukan.`);
      return null;
    }

    if (booking.status !== 'PENDING') {
      console.log(`[ExpirationWorker] Booking ID ${bookingId} sudah berstatus ${booking.status}. Batal diekspirasi.`);
      return null; // Tidak perlu kedaluwarsa ketika statusnya sudah di update landlord
    }

    const expiredBooking = await tx.bookingRequest.update({
      where: { id: bookingId },
      data: { status: 'EXPIRED', version: { increment: 1 } }
    });

    return expiredBooking;
  });

  if (updatedBooking) {
    console.log(`[ExpirationWorker] Booking ID ${bookingId} resmi menjadi EXPIRED.`);

    await sendEmailJob(
      updatedBooking.tenantEmail,
      'Booking Request Expired',
      `<p>Hi ${updatedBooking.tenantName},</p><p>Mohon maaf, permintaan sewa Anda telah **kedaluwarsa (EXPIRED)** karena belum mendapat respons dari pemilik properti dalam jangka waktu 24 jam.</p>`
    );
  }

  return { success: true };
}, { connection: redisConnection as any });

expirationWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[ExpirationWorker] Job ${job.id} gagal: ${err.message}`);
  }
});
