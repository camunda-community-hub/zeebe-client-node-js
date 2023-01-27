import { ZBBatchWorker } from '../zb/ZBBatchWorker'
import {
	BatchedJob,
	ICustomHeaders,
	IInputVariables,
	IOutputVariables,
	ZBBatchWorkerTaskHandler,
} from './interfaces-1.0'
import { Queue } from './Queue'

export class JobBatcher {
	private batchedJobs: Queue<BatchedJob> = new Queue()
	private handler: ZBBatchWorkerTaskHandler<any, any, any>
	private timeout: number
	private batchSize: number
	private worker: ZBBatchWorker<any, any, any>
	private batchExecutionTimerHandle: any
	constructor({
		handler,
		timeout,
		batchSize,
		worker,
	}: {
		handler: ZBBatchWorkerTaskHandler<any, any, any>
		timeout: number
		batchSize: number
		worker: ZBBatchWorker<any, any, any>
	}) {
		this.handler = handler
		this.timeout = timeout
		this.batchSize = batchSize
		this.worker = worker
	}

	public batch(
		batch: Array<
			BatchedJob<IInputVariables, ICustomHeaders, IOutputVariables>
		>
	) {
		if (!this.batchExecutionTimerHandle) {
			this.batchExecutionTimerHandle = setTimeout(
				() => this.execute(),
				this.timeout * 1000
			)
		}
		batch.forEach(this.batchedJobs.push)
		if (this.batchedJobs.length() >= this.batchSize) {
			clearTimeout(this.batchExecutionTimerHandle)
			this.execute()
		}
	}

	private execute() {
		this.batchExecutionTimerHandle = undefined
		this.worker.debug(
			`Executing batched handler with ${this.batchedJobs.length()} jobs`
		)
		try {
			this.handler(this.batchedJobs.drain(), this.worker)
		} catch (e: any) {
			this.worker.error(
				`An unhandled exception occurred in the worker task handler!`
			)
			this.worker.error(e.message)
			this.worker.error(e)
		}
	}
}
