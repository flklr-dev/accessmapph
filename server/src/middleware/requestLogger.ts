import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const isProduction = process.env.NODE_ENV === 'production'

interface LogEntry {
  level: 'info' | 'warn' | 'error'
  type: 'http'
  requestId: string
  method: string
  path: string
  status: number
  durationMs: number
}

function logEntry(entry: LogEntry): void {
  const line = JSON.stringify(entry)
  if (entry.level === 'error') {
    console.error(line)
    return
  }
  if (entry.level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

/** Structured request logging with duration and correlation id. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.originalUrl.startsWith('/api/health')) {
    next()
    return
  }

  const start = process.hrtime.bigint()
  const requestId =
    (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) ||
    randomUUID()

  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6)
    const status = res.statusCode
    const level: LogEntry['level'] =
      status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

    logEntry({
      level,
      type: 'http',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      durationMs,
    })
  })

  next()
}

export function logServerError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error(
    JSON.stringify({
      level: 'error',
      type: 'server',
      context,
      message: err.message,
      ...(extra ?? {}),
      ...(!isProduction && err.stack ? { stack: err.stack } : {}),
    }),
  )
}
