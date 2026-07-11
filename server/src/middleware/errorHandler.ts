import type { NextFunction, Request, Response } from 'express'
import { applyCorsHeaders } from '../lib/corsConfig.js'
import { logServerError } from './requestLogger.js'

const isProduction = process.env.NODE_ENV === 'production'

/** Last-resort error handler — logs context and returns a safe JSON body. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return

  applyCorsHeaders(req, res)

  logServerError('unhandled_route_error', err, {
    method: req.method,
    path: req.originalUrl,
  })

  res.status(500).json({
    error: isProduction ? 'Internal server error.' : err instanceof Error ? err.message : 'Internal server error.',
  })
}
