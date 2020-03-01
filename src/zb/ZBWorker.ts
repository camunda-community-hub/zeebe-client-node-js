import { Chalk } from 'chalk'
import { EventEmitter } from 'events'
import * as uuid from 'uuid'
import { parseVariables } from '../lib'
import * as ZB from '../lib/interfaces'
import { StatefulLogInterceptor } from '../lib/StatefulLogInterceptor'
import { ZBClient } from './ZBClient'

export class ZBWorker<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends EventEmitter {
	private static readonly DEFAULT_JOB_ACTIVATION_TIMEOUT = 60000
	private static readonly DEFAULT_MAX_ACTIVE_JOBS = 32
	public activeJobs = 0
	public gRPCClient: ZB.ZBGrpc
	public maxActiveJobs: number
	public taskType: string
	public timeout: number
	public pollCount = 0
	private closeCallback?: () => void
	private closePromise?: Promise<undefined>
	private closing = false
	private closed = false
	private id = uuid.v4()
	private taskHandler: ZB.ZBWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
	private cancelWorkflowOnException = false
	private zbClient: ZBClient
	private logger: StatefulLogInterceptor
	private longPoll: number
	private debug: boolean
	private restartPollingAfterLongPollTimeout?: NodeJS.Timeout
	private capacityEmitter: EventEmitter
	private keepAlive: NodeJS.Timer
	// Used to prevent worker from exiting when no timers active
	private alivenessBit: number = 0
	private stalled = false
	private onConnectionError: ZB.ConnectionErrorHandler | undefined

	constructor({
		gRPCClient,
		id,
		log,
		options,
		taskHandler,
		taskType,
		zbClient,
		onConnectionError,
	}: {
		gRPCClient: ZB.ZBGrpc
		id: string | null
		taskType: string
		taskHandler: ZB.ZBWorkerTaskHandler<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>
		options: ZB.ZBWorkerOptions & ZB.ZBClientOptions
		idColor: Chalk
		onConnectionError: ZB.ConnectionErrorHandler | undefined
		zbClient: ZBClient
		log: StatefulLogInterceptor
	}) {
		super()
		options = options || {}
		if (!taskType) {
			throw new Error('Missing taskType')
		}
		if (!taskHandler) {
			throw new Error('Missing taskHandler')
		}
		this.taskHandler = taskHandler
		this.taskType = taskType
		this.maxActiveJobs =
			options.maxJobsToActivate || ZBWorker.DEFAULT_MAX_ACTIVE_JOBS
		this.timeout =
			options.timeout || ZBWorker.DEFAULT_JOB_ACTIVATION_TIMEOUT
		this.longPoll =
			options.longPoll || ZBClient.DEFAULT_CONNECTION_TOLERANCE
		this.id = id || uuid.v4()
		// Set options.debug to true to count the number of poll requests for testing
		// See the Worker-LongPoll test
		this.debug = options.debug === true
		this.gRPCClient = gRPCClient
		this.cancelWorkflowOnException =
			options.failWorkflowOnException || false
		this.zbClient = zbClient
		this.logger = log
		this.onConnectionError = onConnectionError

		this.capacityEmitter = new EventEmitter()
		// With long polling there are periods where no timers are running. This prevents the worker exiting.
		this.keepAlive = setInterval(() => {
			this.alivenessBit = (this.alivenessBit + 1) % 1
		}, 10000)
		this.gRPCClient.on('error', (/*err*/) => this.stall(/*err*/))
		this.work()
	}

	/**
	 * Returns a promise that the worker has stopped accepting tasks and
	 * has drained all current active tasks. Will reject if you try to call it more than once.
	 */
	public close(timeout?: number) {
		if (this.closePromise) {
			return this.closePromise
		}
		this.closePromise = new Promise(async resolve => {
			// this.closing prevents the worker from starting work on any new tasks
			this.closing = true
			if (this.restartPollingAfterLongPollTimeout) {
				clearTimeout(this.restartPollingAfterLongPollTimeout)
			}
			// If we have no active tasks right now, resolve immediately.
			// There could be a race condition here if we just polled the server and it is about to return jobs.
			// In any case, we do not start working on those jobs, so they will time out on the server.
			// console.log(
			// 	`Closing ${this.taskType} with ${this.activeJobs} jobs active`
			// ) // @DEBUG

			if (this.activeJobs <= 0) {
				clearInterval(this.keepAlive)
				await this.gRPCClient.close(timeout)
				resolve()
			} else {
				this.capacityEmitter.once('empty', async () => {
					clearInterval(this.keepAlive)
					await this.gRPCClient.close(timeout)
					resolve()
				})
			}
		})
		return this.closePromise
	}

	public work = () => {
		this.logger.logInfo(`Ready for ${this.taskType}...`)
		this.longPollLoop()
	}

	public log(msg: any) {
		this.logger.logInfo(msg)
	}

	private stall(/*error: any*/) {
		if (this.stalled) {
			return
		}
		this.onConnectionError?.()
		this.stalled = true
		this.logger.logError(`Stalled on gRPC error`)
		this.gRPCClient.once('ready', () => {
			this.stalled = false
			this.longPollLoop()
		})
	}

	private async longPollLoop() {
		const result = await this.activateJobs()
		const start = Date.now()
		this.logger.logDebug(
			`Long poll loop. this.longPoll: ${this.longPoll}`,
			Object.keys(result)[0],
			start
		)
		if (result.stream) {
			// This event happens when the server cancels the call after the deadline
			// And when it has completed a response with work
			result.stream.on('end', () => {
				this.logger.logDebug(
					`Stream ended after ${(Date.now() - start) / 1000} seconds`
				)
				clearTimeout(this.restartPollingAfterLongPollTimeout!)
				result.stream.removeAllListeners()
				this.longPollLoop()
			})
			// We do this here because activateJobs may not result in an open gRPC call
			// for example, if the worker is at capacity
			if (!this.closing) {
				this.restartPollingAfterLongPollTimeout = setTimeout(
					() => this.longPollLoop,
					this.longPoll! + 100
				)
			}
		}
		if (result.atCapacity) {
			result.atCapacity.once('available', () => this.longPollLoop())
		}
		if (result.error) {
			this.logger.logError(result.error.message)
			setTimeout(() => this.longPollLoop(), 1000) // @TODO implement backoff
		}
	}

	private async activateJobs() {
		if (this.stalled) {
			return { stalled: true }
		}
		if (this.closing) {
			return {
				closing: true,
			}
		}
		if (this.debug) {
			this.logger.logDebug('Activating Jobs')
		}
		let stream: any
		if (this.activeJobs >= this.maxActiveJobs) {
			this.logger.logInfo(
				`Worker at max capacity - ${this.taskType} has ${this.activeJobs} and a capacity of ${this.maxActiveJobs}.`
			)
			return { atCapacity: this.capacityEmitter }
		}

		const amount = this.maxActiveJobs - this.activeJobs

		const requestTimeout = this.longPoll || -1

		const activateJobsRequest: ZB.ActivateJobsRequest = {
			maxJobsToActivate: amount,
			requestTimeout,
			timeout: this.timeout,
			type: this.taskType,
			worker: this.id,
		}
		this.logger.logDebug(
			`Requesting ${amount} jobs with requestTimeout ${requestTimeout}`
		)

		try {
			stream = await this.gRPCClient.activateJobsStream(
				activateJobsRequest
			)
			if (this.debug) {
				this.pollCount++
			}
		} catch (error) {
			return {
				error,
			}
		}

		stream.on('data', (res: ZB.ActivateJobsResponse) => {
			// If we are closing, don't start working on these jobs. They will have to be timed out by the server.
			if (this.closing) {
				return
			}
			const parsedVariables = res.jobs.map(parseVariables)
			this.activeJobs += parsedVariables.length
			// Call task handler for each new job
			parsedVariables.forEach(job => this.handleJob(job))
		})

		return { stream }
	}

	private drainOne() {
		this.activeJobs--
		this.logger.logDebug(`Load: ${this.activeJobs}/${this.maxActiveJobs}`)
		if (!this.closing && this.activeJobs < this.maxActiveJobs * 0.75) {
			this.capacityEmitter.emit('available')
		}
		if (this.closing && this.activeJobs === 0) {
			this.capacityEmitter.emit('empty')
		}
		// If we are closing and hit zero active jobs, resolve the closing promise.
		if (this.activeJobs <= 0 && this.closing) {
			if (this.closeCallback && !this.closed) {
				this.closeCallback()
			}
		}
	}

	private async handleJob(job: ZB.ActivatedJob) {
		const customHeaders = JSON.parse(job.customHeaders || '{}')

		const taskId = uuid.v4()
		try {
			/**
			 * complete.success(variables?: object) and complete.failure(errorMessage: string, retries?: number)
			 *
			 * To halt execution of the business process and raise an incident in Operate, call
			 * complete.failure(errorMessage, 0)
			 */

			const workerCallback = {
				error: (errorCode: string, errorMessage: string = '') => {
					this.zbClient
						.throwError({
							errorCode,
							errorMessage,
							jobKey: job.key,
						})
						.finally(() => {
							this.logger.logDebug(
								`Errored job ${job.key} - ${errorMessage}`
							)
							this.drainOne()
						})
				},
				failure: (
					errorMessage,
					retries = Math.max(0, job.retries - 1)
				) => {
					this.zbClient
						.failJob({
							errorMessage,
							jobKey: job.key,
							retries,
						})
						.finally(() => {
							this.logger.logDebug(
								`Failed job ${job.key} - ${errorMessage}`
							)
							this.drainOne()
						})
				},
				forwarded: () => this.drainOne(),
				success: (completedVariables = {}) => {
					return this.zbClient
						.completeJob({
							jobKey: job.key,
							variables: completedVariables,
						})
						.then(res => {
							this.logger.logDebug(
								`Completed task ${taskId} for ${this.taskType}`
							)
							return res
						})
						.catch(e => {
							this.logger.logDebug(
								`Completing task ${taskId} for ${this.taskType} threw ${e.message}`
							)
							return e
						})
						.finally(() => {
							this.drainOne()
						})
				},
			}

			await this.taskHandler(
				{ ...job, customHeaders: { ...customHeaders } } as any,
				workerCallback,
				this
			)
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
