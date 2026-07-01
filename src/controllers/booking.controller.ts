import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/response';
import { BookingService } from '../services/booking.service';
import { BookingStatus } from '@prisma/client';

export class BookingController {
  
  static async getRequests(req: AuthRequest, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as BookingStatus;

      const result = await BookingService.getBookingRequests(req.user!, status, page, limit);
      
      return sendSuccess(res, 200, 'Booking requests retrieved', result.data, result.meta);
    } catch (error: any) {
      console.error('Error in getRequests:', error);
      return sendError(res, typeof error.code === 'number' ? error.code : 500, error.type || 'ERR_INTERNAL', error.message || 'Internal Server Error');
    }
  }

  static async createRequest(req: AuthRequest, res: Response) {
    try {
      const booking = await BookingService.createBookingRequest(req.body, req.user!.id);
      return sendSuccess(res, 201, 'Booking request submitted. Expires in 24 hours.', booking);
    } catch (error: any) {
      return sendError(res, typeof error.code === 'number' ? error.code : 500, error.type || 'ERR_INTERNAL', error.message || 'Internal Server Error');
    }
  }

  static async updateRequest(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      
      const result = await BookingService.processBookingRequest(id, status as BookingStatus, req.user!.id);
      return sendSuccess(res, 200, `Booking request ${status.toLowerCase()}ed successfully`, result);
    } catch (error: any) {
      return sendError(res, typeof error.code === 'number' ? error.code : 500, error.type || 'ERR_INTERNAL', error.message || 'Internal Server Error');
    }
  }
}
