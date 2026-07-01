import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: 'TENANT' | 'LANDLORD';
  };
}

export const mockAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const landlordId = req.headers['x-landlord-id'] as string;

  if (tenantId) {
    req.user = { id: tenantId, role: 'TENANT' };
    return next();
  }

  if (landlordId) {
    req.user = { id: landlordId, role: 'LANDLORD' };
    return next();
  }

  return sendError(res, 401, 'ERR_UNAUTHORIZED', 'Unauthorized: Missing x-tenant-id or x-landlord-id header');
};

export const requireLandlord = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'LANDLORD') {
    return sendError(res, 403, 'ERR_FORBIDDEN', 'Forbidden: Only landlord can perform this action');
  }
  next();
};

export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'TENANT') {
    return sendError(res, 403, 'ERR_FORBIDDEN', 'Forbidden: Only tenant can perform this action');
  }
  next();
};
