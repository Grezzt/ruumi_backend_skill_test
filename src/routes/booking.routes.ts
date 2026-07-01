import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { mockAuth, requireLandlord, requireTenant } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate';
import { createBookingSchema, updateBookingSchema } from '../schemas/booking.schema';

const router = Router();

// Apply mock authentication to all routes below
router.use(mockAuth);

router.get('/', BookingController.getRequests);

// Only tenants can create requests
router.post('/', requireTenant, validate(createBookingSchema), BookingController.createRequest);

// Only landlords can process requests (Accept/Reject)
router.patch('/:id', requireLandlord, validate(updateBookingSchema), BookingController.updateRequest);

export default router;
