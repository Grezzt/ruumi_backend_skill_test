import request from 'supertest';
import app from '../app';
import { prisma } from '../utils/db';

// Mock BullMQ functions to avoid connecting to Redis during tests
jest.mock('../workers/email.queue', () => ({
  sendEmailJob: jest.fn().mockResolvedValue(true),
}));

jest.mock('../workers/expiration.queue', () => ({
  scheduleExpirationJob: jest.fn().mockResolvedValue(true),
}));

describe('Booking API & Concurrency Guard', () => {
  let createdBookingId = '';
  const tenantId = 'tenant-test-uuid-123';
  let propertyId = '';
  let landlordId = '';

  beforeAll(async () => {
    // Ambil satu properti dari hasil seeding database untuk bahan test
    const property = await prisma.property.findFirst();
    if (!property) {
      throw new Error('Database is empty. Please run "npm run setup" first to seed data.');
    }
    propertyId = property.id;
    landlordId = property.landlordId;
  });

  it('GET /api/booking-requests tanpa auth header harus mengembalikan 401 Unauthorized', async () => {
    const res = await request(app).get('/api/booking-requests');
    expect(res.status).toBe(401);
  });

  it('GET /api/booking-requests dengan x-tenant-id harus berhasil', async () => {
    const res = await request(app)
      .get('/api/booking-requests')
      .set('x-tenant-id', tenantId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/booking-requests harus berhasil membuat request (201)', async () => {
    const res = await request(app)
      .post('/api/booking-requests')
      .set('x-tenant-id', tenantId)
      .send({
        propertyId,
        tenantName: 'Andhika Test',
        tenantEmail: 'andhika@gmail.com',
        requestedViewingAt: new Date().toISOString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe('PENDING');

    createdBookingId = res.body.data.id; // Simpan ID untuk tes selanjutnya
  });

  it('PATCH /api/booking-requests/:id - TANTANGAN A: Simultaneous Race Conditions Test', async () => {
    // Mengirim 3 request PATCH secara BERSAMAAN menggunakan Promise.all
    // mensimulasikan Race Condition, di mana sistem harus memblokir 2 request dan meloloskan 1.
    const req1 = request(app)
      .patch(`/api/booking-requests/${createdBookingId}`)
      .set('x-landlord-id', landlordId)
      .send({ status: 'ACCEPT' });

    const req2 = request(app)
      .patch(`/api/booking-requests/${createdBookingId}`)
      .set('x-landlord-id', landlordId)
      .send({ status: 'REJECT' });

    const req3 = request(app)
      .patch(`/api/booking-requests/${createdBookingId}`)
      .set('x-landlord-id', landlordId)
      .send({ status: 'ACCEPT' });

    const responses = await Promise.all([req1, req2, req3]);

    // ekspektasi satu response bernilai 200 (Berhasil memproses PENDING -> ACCEPT/REJECT)
    const successCount = responses.filter(r => r.status === 200).length;

    // sisanya harus bernilai 409 (Conflict/Optimistic Locking) atau 400 (Bad Request/Expired)
    const conflictCount = responses.filter(r => r.status === 409 || r.status === 400).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(2);
  });

  it('PATCH /api/booking-requests/:id dengan status invalid harus mengembalikan 400', async () => {
    const res = await request(app)
      .patch(`/api/booking-requests/${createdBookingId}`)
      .set('x-landlord-id', landlordId)
      .send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(400);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
