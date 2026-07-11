import { randomUUID } from 'node:crypto'
import type { RedisClientType } from 'redis'
import { getRedisClient } from './redis.js'

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface JobRecord {
  id: string
  name: string
  status: JobStatus
  attempts: number
  error?: string
  createdAt: string
  updatedAt: string
}

interface JobMessage {
  id: string
  name: string
  payload: unknown
  attempts: number
}

type JobHandler = (payload: unknown) => Promise<void>

const QUEUE_KEY = 'jobs:queue'
const JOB_STATUS_TTL_SEC = 7 * 24 * 60 * 60
const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 5_000

const handlers = new Map<string, JobHandler>()
const memoryQueue: string[] = []
const memoryStatuses = new Map<string, string>()
const memoryOwners = new Map<string, string>()
let memoryDrainRunning = false
let redisWorkerStarted = false

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function registerJobHandler(name: string, handler: JobHandler): void {
  handlers.set(name, handler)
}

async function readJobStatus(jobId: string): Promise<JobRecord | null> {
  const redis = getRedisClient()
  const raw = redis
    ? await redis.get(`jobs:status:${jobId}`)
    : memoryStatuses.get(jobId)
  if (!raw) return null
  return JSON.parse(raw) as JobRecord
}

async function writeJobStatus(jobId: string, patch: Partial<JobRecord> & { name: string }): Promise<void> {
  const existing = (await readJobStatus(jobId)) ?? {
    id: jobId,
    name: patch.name,
    status: 'queued' as const,
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const next: JobRecord = {
    ...existing,
    ...patch,
    id: jobId,
    name: patch.name,
    updatedAt: new Date().toISOString(),
  }

  const json = JSON.stringify(next)
  const redis = getRedisClient()
  if (redis) {
    await redis.set(`jobs:status:${jobId}`, json, { EX: JOB_STATUS_TTL_SEC })
  } else {
    memoryStatuses.set(jobId, json)
  }
}

export async function getJobStatus(jobId: string): Promise<JobRecord | null> {
  return readJobStatus(jobId)
}

async function setJobOwner(jobId: string, ownerId: string): Promise<void> {
  const redis = getRedisClient()
  if (redis) {
    await redis.set(`jobs:owner:${jobId}`, ownerId, { EX: JOB_STATUS_TTL_SEC })
  } else {
    memoryOwners.set(jobId, ownerId)
  }
}

export async function jobOwnedBy(jobId: string, ownerId: string): Promise<boolean> {
  const redis = getRedisClient()
  const stored = redis ? await redis.get(`jobs:owner:${jobId}`) : memoryOwners.get(jobId)
  return stored === ownerId
}

export async function enqueueJob(
  name: string,
  payload: unknown,
  options?: { ownerId?: string },
): Promise<string> {
  if (!handlers.has(name)) {
    throw new Error(`No handler registered for job: ${name}`)
  }

  const id = randomUUID()
  const message: JobMessage = { id, name, payload, attempts: 0 }
  const raw = JSON.stringify(message)

  await writeJobStatus(id, { name, status: 'queued', attempts: 0 })

  if (options?.ownerId) {
    await setJobOwner(id, options.ownerId)
  }

  const redis = getRedisClient()
  if (redis) {
    await redis.lPush(QUEUE_KEY, raw)
  } else {
    memoryQueue.push(raw)
    void drainMemoryQueue()
  }

  return id
}

async function requeueJob(message: JobMessage, error: unknown): Promise<void> {
  const errText = error instanceof Error ? error.message : String(error)
  await writeJobStatus(message.id, {
    name: message.name,
    status: 'queued',
    attempts: message.attempts,
    error: errText,
  })

  const raw = JSON.stringify(message)
  const redis = getRedisClient()
  if (redis) {
    await sleep(RETRY_DELAY_MS)
    await redis.lPush(QUEUE_KEY, raw)
  } else {
    memoryQueue.push(raw)
    void drainMemoryQueue()
  }
}

async function processJob(raw: string): Promise<void> {
  const message = JSON.parse(raw) as JobMessage
  const handler = handlers.get(message.name)
  if (!handler) {
    console.error(`[jobs] unknown job type: ${message.name}`)
    return
  }

  await writeJobStatus(message.id, {
    name: message.name,
    status: 'processing',
    attempts: message.attempts,
  })

  try {
    await handler(message.payload)
    await writeJobStatus(message.id, {
      name: message.name,
      status: 'completed',
      attempts: message.attempts,
      error: undefined,
    })
    console.log(`[jobs] completed ${message.name} (${message.id})`)
  } catch (error) {
    message.attempts += 1
    const errText = error instanceof Error ? error.message : String(error)
    console.error(`[jobs] failed ${message.name} (${message.id}) attempt ${message.attempts}:`, errText)

    if (message.attempts < MAX_ATTEMPTS) {
      await requeueJob(message, error)
      return
    }

    await writeJobStatus(message.id, {
      name: message.name,
      status: 'failed',
      attempts: message.attempts,
      error: errText,
    })
  }
}

async function drainMemoryQueue(): Promise<void> {
  if (memoryDrainRunning) return
  memoryDrainRunning = true

  while (memoryQueue.length > 0) {
    const raw = memoryQueue.shift()
    if (!raw) continue
    try {
      await processJob(raw)
    } catch (error) {
      console.error('[jobs] unexpected processor error:', error)
    }
  }

  memoryDrainRunning = false
}

async function runRedisWorker(redis: RedisClientType): Promise<void> {
  for (;;) {
    try {
      const result = await redis.brPop(QUEUE_KEY, 5)
      if (!result) continue
      await processJob(result.element)
    } catch (error) {
      console.error('[jobs] Redis worker error:', error)
      await sleep(1_000)
    }
  }
}

/** Start background workers. Safe to call once at process startup. */
export function startJobWorker(): void {
  if (handlers.size === 0) {
    console.warn('[jobs] no handlers registered — worker not started')
    return
  }

  const redis = getRedisClient()
  if (redis && !redisWorkerStarted) {
    redisWorkerStarted = true
    console.log('[jobs] Redis-backed worker started')
    void runRedisWorker(redis)
    return
  }

  if (!redis) {
    console.log('[jobs] in-memory worker ready')
    void drainMemoryQueue()
  }
}

export async function getQueueStats(): Promise<{ pending: number; backend: 'redis' | 'memory' }> {
  const redis = getRedisClient()
  if (redis) {
    const pending = await redis.lLen(QUEUE_KEY)
    return { pending, backend: 'redis' }
  }
  return { pending: memoryQueue.length, backend: 'memory' }
}
