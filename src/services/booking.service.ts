import { BookingStatus } from '@prisma/client';
import { BookingRepository } from '../repositories/booking.repository';
import { prisma } from '../utils/db';
import { sendEmailJob } from '../workers/email.queue';
import { scheduleExpirationJob } from '../workers/expiration.queue';
import { generateEmailTemplate } from '../utils/emailTemplate';

const bookingRepo = new BookingRepository(prisma);

export class BookingService {

  static async getBookingRequests(user: { id: string; role: 'TENANT' | 'LANDLORD' }, status?: BookingStatus, page: number = 1, limit: number = 10) {
    const filters: any = {};

    // Authorization filter
    if (user.role === 'TENANT') {
      filters.tenantId = user.id;
    } else {
      filters.landlordId = user.id;
    }

    // Optional status filter
    if (status) {
      filters.status = status;
    }

    const { data, total } = await bookingRepo.findMany(filters, page, limit);

    return {
      data,
      meta: {
        page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  static async createBookingRequest(payload: any, tenantId: string) {


    const property = await prisma.property.findUnique({ where: { id: payload.propertyId } });
    if (!property) {
      throw { code: 404, type: 'ERR_NOT_FOUND', message: 'Property not found' };
    }

    // Untuk keperluan testing, EXPIRATION_DELAY_MS bisa diset di .env (misal 10000 untuk 10 detik).
    // Jika EXPIRATION_DELAY_MS tidak ada di .env, defaultnya adalah 24 jam (86400000 ms).
    const delayMs = process.env.EXPIRATION_DELAY_MS ? parseInt(process.env.EXPIRATION_DELAY_MS, 10) : 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + delayMs);

    const booking = await bookingRepo.create({
      propertyId: property.id,
      tenantId,
      landlordId: property.landlordId,
      tenantName: payload.tenantName,
      tenantEmail: payload.tenantEmail,
      requestedViewingAt: new Date(payload.requestedViewingAt),
      status: 'PENDING',
      expiresAt
    });

    const emailHtml = generateEmailTemplate(
      'Permintaan Sewa Baru',
      `<p>Hi <b>${payload.tenantName}</b>,</p><p>Permintaan sewa Anda untuk properti telah masuk ke sistem kami. Pemilik properti (Landlord) memiliki waktu 24 jam untuk memberikan tanggapan sebelum permintaan ini otomatis dibatalkan.</p>`,
      {
        'ID Permintaan': booking.id,
        'Properti': property.name,
        'Tanggal Survey': new Date(payload.requestedViewingAt).toLocaleString('id-ID'),
        'Kadaluwarsa Pada': expiresAt.toLocaleString('id-ID')
      }
    );

    await sendEmailJob(
      payload.tenantEmail,
      'Ruumi - Permintaan Sewa Diterima',
      emailHtml
    );

    await scheduleExpirationJob(booking.id, delayMs);

    return booking;
  }

  static async processBookingRequest(id: string, status: BookingStatus, landlordId: string) {


    const request = await bookingRepo.findById(id);
    if (!request) {
      throw { code: 404, type: 'ERR_NOT_FOUND', message: 'Booking request not found' };
    }

    if (request.landlordId !== landlordId) {
      throw { code: 403, type: 'ERR_FORBIDDEN', message: 'You are not the landlord of this property' };
    }

    if (request.status !== 'PENDING') {
      throw { code: 400, type: 'ERR_BAD_REQUEST', message: `Cannot process request: current status is ${request.status}` };
    }

    if (new Date() > request.expiresAt) {
      throw { code: 400, type: 'ERR_BAD_REQUEST', message: 'Cannot process request: current status is EXPIRED' };
    }

    // --- OPTIMISTIC LOCKING: CONCURRENCY GUARD ---
    const success = await bookingRepo.updateStatusWithLock(id, request.version, status);

    if (!success) {
      throw { code: 409, type: 'ERR_CONFLICT', message: 'Data conflict: The request has already been modified by another process' };
    }

    const statusText = status === 'ACCEPT'
      ? '<span style="color: #16a34a; font-weight: bold;">DISETUJUI (ACCEPT)</span>'
      : '<span style="color: #dc2626; font-weight: bold;">DITOLAK (REJECT)</span>';

    const emailHtml = generateEmailTemplate(
      `Pembaruan Status Sewa`,
      `<p>Hi <b>${request.tenantName}</b>,</p><p>Pemilik properti telah merespons permintaan sewa Anda. Status permintaan Anda saat ini adalah: ${statusText}.</p>`,
      {
        'ID Permintaan': request.id,
        'Properti': request.property.name,
        'Tanggal Survey': new Date(request.requestedViewingAt).toLocaleString('id-ID'),
      }
    );

    await sendEmailJob(
      request.tenantEmail,
      `Ruumi - Status Permintaan Sewa: ${status}`,
      emailHtml
    );

    return { id, status };
  }
}
