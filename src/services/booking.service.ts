import { BookingStatus } from '@prisma/client';
import { BookingRepository } from '../repositories/booking.repository';
import { prisma } from '../utils/db';

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
    if (!payload.propertyId || !payload.tenantName || !payload.tenantEmail || !payload.requestedViewingAt) {
      throw { code: 400, type: 'ERR_BAD_REQUEST', message: 'Missing required fields: propertyId, tenantName, tenantEmail, requestedViewingAt' };
    }

    const property = await prisma.property.findUnique({ where: { id: payload.propertyId } });
    if (!property) {
      throw { code: 404, type: 'ERR_NOT_FOUND', message: 'Property not found' };
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

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

    // TODO: Add to BullMQ Delayed Queue for expiration (Phase 5)
    // TODO: Add to BullMQ Email Queue for landlord notification (Phase 4)
    
    return booking;
  }

  static async processBookingRequest(id: string, status: BookingStatus, landlordId: string) {
    if (status !== 'ACCEPT' && status !== 'REJECT') {
      throw { code: 400, type: 'ERR_BAD_REQUEST', message: 'Status must be either ACCEPT or REJECT' };
    }

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
    // Instead of doing `.update()`, we use our repository's atomic updateMany which checks the version.
    const success = await bookingRepo.updateStatusWithLock(id, request.version, status);
    
    if (!success) {
      throw { code: 409, type: 'ERR_CONFLICT', message: 'Data conflict: The request has already been modified by another process' };
    }

    // TODO: Add to BullMQ Email Queue for tenant notification (Phase 4)

    return { id, status };
  }
}
