import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    propertyId: z.string({ message: 'Property ID is required' }),
    tenantName: z.string({ message: 'Tenant name is required' }).min(3, 'Name must be at least 3 characters'),
    tenantEmail: z.string({ message: 'Email is required' }).email('Invalid email address format'),
    requestedViewingAt: z.string({ message: 'Viewing date is required' }).refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format (must be ISO string)'
    })
  })
});

export const updateBookingSchema = z.object({
  body: z.object({
    status: z.enum(['ACCEPT', 'REJECT'], {
      message: 'Status must be either ACCEPT or REJECT'
    })
  })
});
