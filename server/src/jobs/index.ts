import { registerJobHandler, startJobWorker } from '../lib/jobQueue.js'
import { runAccountDeletionJob } from './accountDelete.js'

export function initJobWorkers(): void {
  registerJobHandler('account.delete', runAccountDeletionJob)
  startJobWorker()
}
