import * as ZB from '../lib/interfaces-1.0'

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
		jobs: ZB.Job<WorkerInputVariables, CustomHeaderShape>[]
	) {
		// Call task handler for each new job
		jobs.forEach(async job => this.handleJob(job))
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
			>)(
				{
					...job,
					cancelWorkflow: workerCallback.cancelWorkflow,
					complete: workerCallback.complete,
					fail: workerCallback.fail,
					error: workerCallback.error,
					forward: workerCallback.forward,
				},
				this
			)
		} catch (e: any) {
			this.logger.logError(
				`Caught an unhandled exception in a task handler for process instance ${job.processInstanceKey}:`
			)
			this.logger.logDebug(job)
			this.logger.logError(e.message)
			if (this.cancelWorkflowOnException) {
				const { processInstanceKey } = job
				this.logger.logDebug(
					`Cancelling process instance ${processInstanceKey}`
				)
				try {
					await this.zbClient.cancelProcessInstance(
						processInstanceKey
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
						retryBackOff: 0,
					})
				} catch (e: any) {
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
