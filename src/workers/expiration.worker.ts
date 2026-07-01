import { Worker, Job } from 'bullmq';
import { redisConnection } from '../utils/redis';
import { prisma } from '../utils/db';
import { sendEmailJob } from './email.queue';
import { generateEmailTemplate } from '../utils/emailTemplate';

export const expirationWorker = new Worker('expiration-queue', async (job: Job) => {
  const { bookingId } = job.data;
  console.log(`[ExpirationWorker] Memeriksa kedaluwarsa untuk Booking ID: ${bookingId}`);

  const updatedBooking = await prisma.$transaction(async (tx) => {
    const booking = await tx.bookingRequest.findUnique({
      where: { id: bookingId },
      include: { property: true }
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
      data: { status: 'EXPIRED', version: { increment: 1 } },
      include: { property: true }
    });

    return expiredBooking;
  });

  if (updatedBooking) {
    console.log(`[ExpirationWorker] Booking ID ${bookingId} resmi menjadi EXPIRED.`);

    const emailHtml = generateEmailTemplate(
      'Permintaan Sewa Expired',
      `<p>Hi <b>${updatedBooking.tenantName}</b>,</p><p>Mohon maaf, permintaan sewa Anda telah <span style="color: #dc2626; font-weight: bold;">EXPIRED</span> karena belum mendapat tanggapan dari pemilik properti dalam batas waktu 24 jam.</p><p>Silakan mencoba untuk menghubungi pemilik properti lain atau mengajukan ulang permintaan Anda.</p>`,
      {
        'ID Permintaan': updatedBooking.id,
        'Properti': updatedBooking.property.name,
        'Tanggal Survey': new Date(updatedBooking.requestedViewingAt).toLocaleString('id-ID')
      }
    );

    await sendEmailJob(
      updatedBooking.tenantEmail,
      'Ruumi - Permintaan Sewa Expired',
      emailHtml
    );
  }

  return { success: true };
}, { connection: redisConnection as any });

expirationWorker.on('failed', (job, err) => {
  if (job) {
    console.error(`[ExpirationWorker] Job ${job.id} gagal: ${err.message}`);
  }
});
