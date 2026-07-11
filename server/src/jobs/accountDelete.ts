import { getRedisClient } from '../lib/redis.js'
import { enqueueJob } from '../lib/jobQueue.js'
import { deleteUserAccount } from '../services/userService.js'

const DEDUPE_TTL_SEC = 60 * 60

function dedupeKey(firebaseUid: string): string {
  return `jobs:pending:account-delete:${firebaseUid}`
}

export async function enqueueAccountDeletion(firebaseUid: string): Promise<string> {
  const redis = getRedisClient()
  if (redis) {
    const existingJobId = await redis.get(dedupeKey(firebaseUid))
    if (existingJobId) return existingJobId
  }

  const jobId = await enqueueJob('account.delete', { firebaseUid }, { ownerId: firebaseUid })

  if (redis) {
    await redis.set(dedupeKey(firebaseUid), jobId, { EX: DEDUPE_TTL_SEC })
  }

  return jobId
}

export async function clearAccountDeletionDedupe(firebaseUid: string): Promise<void> {
  const redis = getRedisClient()
  if (redis) {
    await redis.del(dedupeKey(firebaseUid))
  }
}

export async function runAccountDeletionJob(payload: unknown): Promise<void> {
  const { firebaseUid } = payload as { firebaseUid?: string }
  if (!firebaseUid) {
    throw new Error('ACCOUNT_DELETE_MISSING_UID')
  }

  try {
    await deleteUserAccount(firebaseUid)
  } finally {
    await clearAccountDeletionDedupe(firebaseUid)
  }
}
