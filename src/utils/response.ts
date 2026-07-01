import { Response } from 'express';

export const sendSuccess = (res: Response, code: number, message: string, data: any = null, meta: any = undefined) => {
  return res.status(code).json({
    success: true,
    code,
    message,
    data,
    ...(meta && { meta })
  });
};

export const sendError = (res: Response, code: number, type: string, message: string, errors: any = null) => {
  return res.status(code).json({
    success: false,
    code,
    type,
    message,
    errors
  });
};
