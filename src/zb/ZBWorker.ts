import * as ZB from '../lib/interfaces'

import { ZBWorkerBase, ZBWorkerConstructorConfig } from '../lib/ZBWorkerBase'

export class ZBWorker<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends ZBWorkerBase<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> {
	constructor(
		config: ZBWorkerConstructorConfig<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>
	) {
		super(config)
	}

	protected handleJobs(
		jobs: Array<ZB.Job<WorkerInputVariables, CustomHeaderShape>>
	) {
		// Call task handler for each new job
		jobs.forEach(job => this.handleJob(job))
	}

	protected async handleJob(
		job: ZB.Job<WorkerInputVariables, CustomHeaderShape>
	) {
		try {
			/**
			 * complete.success(variables?: object) and complete.failure(errorMessage: string, retries?: number)
			 *
			 * To halt execution of the business process and raise an incident in Operate, call
			 * complete.failure(errorMessage, 0)
			 */

			const workerCallback = this.makeCompleteHandlers(job)

			await (this.taskHandler as ZB.ZBWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
			>)(job, workerCallback, this)
		} catch (e) {
			this.logger.logError(
				`Caught an unhandled exception in a task handler for workflow instance ${job.workflowInstanceKey}:`
			)
			this.logger.logDebug(job)
			this.logger.logError(e.message)
			if (this.cancelWorkflowOnException) {
				const { workflowInstanceKey } = job
				this.logger.logDebug(
					`Cancelling workflow instance ${workflowInstanceKey}`
				)
				try {
					await this.zbClient.cancelWorkflowInstance(
						workflowInstanceKey
					)
				} finally {
					this.drainOne()
				}
			} else {
				this.logger.logInfo(`Failing job ${job.key}`)
				const retries = job.retries - 1
				try {
					this.zbClient.failJob({
						errorMessage: `Unhandled exception in task handler ${e}`,
						jobKey: job.key,
						retries,
					})
				} catch (e) {
					this.logger.logDebug(e)
				} finally {
					this.drainOne()
					if (retries > 0) {
						this.logger.logDebug(
							`The Zeebe engine will handle the retry. Retries left: ${retries}`
						)
					} else {
						this.logger.logDebug('No retries left for this task')
					}
				}
			}
		}
	}
}
