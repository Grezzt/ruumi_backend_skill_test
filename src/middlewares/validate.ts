import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return sendError(
          res, 
          422, 
          'ERR_UNPROCESSABLE_ENTITY', 
          'Validation failed', 
          errorMessages
        );
      }
      return sendError(res, 500, 'ERR_INTERNAL', 'Internal server error');
    }
  };
};
