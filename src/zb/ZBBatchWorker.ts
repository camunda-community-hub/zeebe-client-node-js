import * as ZB from '../lib/interfaces'
import {
	ZBBatchWorkerConstructorConfig,
	ZBWorkerBase,
} from '../lib/ZBWorkerBase'

export class ZBBatchWorker<
	InputVariables,
	Headers,
	OutputVariables
> extends ZBWorkerBase<InputVariables, Headers, OutputVariables> {
	constructor(
		config: ZBBatchWorkerConstructorConfig<
			InputVariables,
			Headers,
			OutputVariables
		>
	) {
		super(config)
	}

	protected async handleJobs(jobs: Array<ZB.Job<InputVariables, Headers>>) {
		const batchedJobs = jobs.map(
			(job): ZB.BatchedJob<InputVariables, Headers, OutputVariables> => ({
				...job,
				...this.makeCompleteHandlers(job),
			})
		)
		try {
			// Call task handler for the job batch
			await (this.taskHandler as ZB.ZBBatchWorkerTaskHandler<
				InputVariables,
				Headers,
				OutputVariables
			>)(batchedJobs, this)
		} catch (e) {
			this.logger.logError(
				`Caught an unhandled exception in a task handler for batched jobs:`
			)
			this.logger.logError(e.message)
		}
	}
}
