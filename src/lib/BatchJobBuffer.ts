import { ZBBatchWorker } from '../zb/ZBBatchWorker'
import { ZBBatchWorkerTaskHandler } from './interfaces'

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
	let jobs: any[] = []
	let t
	const execute = () => {
		clearTimeout(t)
		t = undefined
		if (jobs.length === 0) {
			return
		}
		worker.log(`Executing batched handler with ${jobs.length} jobs`)
		try {
			handler([...jobs], worker)
		} catch (e) {
			worker.error(
				`An unhandled exception occurred in the worker task handler!`
			)
			worker.log(e.message)
			worker.log(e)
		}
		jobs = []
	}
	const startBatchTimer = () => setTimeout(execute, timeout * 1000)
	return {
		batch: batch => {
			if (!t) {
				t = startBatchTimer()
			}
			jobs = [...jobs, ...batch]
			if (jobs.length >= batchSize) {
				execute()
			}
		},
	}
}
