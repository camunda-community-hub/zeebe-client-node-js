import { ZBBatchWorker } from '../zb/ZBBatchWorker'
import { BatchedJob, ZBBatchWorkerTaskHandler } from './interfaces'

export const JobBuffer = ({
	handler,
	timeout,
	batchSize,
	worker,
}: {
	handler: ZBBatchWorkerTaskHandler<any, any, any>
	timeout: number
	batchSize: number
	worker: ZBBatchWorker<any, any, any>
}) => {
	let jobs: BatchedJob[] = []
	let t
	const execute = (batch: BatchedJob[]) => {
		t = undefined
		jobs = []
		worker.debug(`Executing batched handler with ${batch.length} jobs`)
		try {
			handler(batch, worker)
		} catch (e) {
			worker.error(
				`An unhandled exception occurred in the worker task handler!`
			)
			worker.error(e.message)
			worker.error(e)
		}
	}
	return {
		batch: batch => {
			if (!t) {
				t = setTimeout(() => execute([...jobs]), timeout * 1000)
			}
			jobs = [...jobs, ...batch]
			if (jobs.length >= batchSize) {
				clearTimeout(t)
				execute([...jobs])
			}
		},
	}
}
