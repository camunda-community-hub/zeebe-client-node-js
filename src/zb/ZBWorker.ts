import chalk, { Chalk } from 'chalk'
import { EventEmitter } from 'events'
import * as uuid from 'uuid'
import { parseVariables, stringifyVariables } from '../lib'
import * as ZB from '../lib/interfaces'
import { ZBLogger } from '../lib/ZBLogger'
import { ZBClient } from './ZBClient'

export class ZBWorker<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> {
	public activeJobs = 0
	public gRPCClient: any
	public maxActiveJobs: number
	public taskType: string
	public timeout: number
	public pollCount = 0

	private closeCallback?: () => void
	private closePromise?: Promise<undefined>
	private closing = false
	private closed = false
	private errored = false
	private id = uuid.v4()
	private onConnectionErrorHandler?: ZB.ConnectionErrorHandler
	// The handle for the fast poll timer
	private fastPollHandle?: NodeJS.Timeout
	private pollInterval: number
	private taskHandler: ZB.ZBWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
	private cancelWorkflowOnException = false
	private zbClient: ZBClient
	private logger: ZBLogger
	private longPoll?: number
	private debug: boolean
	private restartPollingAfterLongPollTimeout?: NodeJS.Timeout
	private capacityEmitter: EventEmitter
	private keepAlive: NodeJS.Timer
	// Used to prevent worker from exiting when no timers active
	private alivenessBit: number = 0
	// Used to block fast poll when an ActivateJobRequest is in-flight
	private fastPollInFlight = false

	constructor({
		gRPCClient,
		id,
		idColor,
		onConnectionError,
		options,
		taskHandler,
		taskType,
		zbClient,
	}: {
		gRPCClient: any
		id: string
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
	}) {
		options = options || {}
		if (!taskType) {
			throw new Error('Missing taskType')
		}
		if (!taskHandler) {
			throw new Error('Missing taskHandler')
		}
		this.taskHandler = taskHandler
		this.taskType = taskType
		this.maxActiveJobs = options.maxJobsToActivate || 32
		this.timeout = options.timeout || 1000
		this.pollInterval = options.pollInterval || 100
		this.longPoll = options.longPoll
		this.id = id || uuid.v4()
		this.debug = options.debug === true
		this.gRPCClient = gRPCClient
		this.onConnectionErrorHandler = onConnectionError
		const loglevel = options.loglevel || 'INFO'
		this.cancelWorkflowOnException =
			options.failWorkflowOnException || false
		this.zbClient = zbClient
		this.logger = new ZBLogger({
			color: idColor,
			id: this.id,
			loglevel,
			namespace: 'ZBWorker',
			pollMode: this.longPoll ? 'Long Poll' : 'Fast Poll',
			stdout: options.stdout || console,
			taskType: this.taskType,
		})
		this.capacityEmitter = new EventEmitter()
		// With long polling there are periods where no timers are running. This prevents the worker exiting.
		this.keepAlive = setInterval(() => {
			this.alivenessBit = (this.alivenessBit + 1) % 1
		}, 10000)
		this.work()
	}

	/**
	 * Returns a promise that the worker has stopped accepting tasks and
	 * has drained all current active tasks. Will reject if you try to call it more than once.
	 */
	public close() {
		if (this.closePromise) {
			return this.closePromise
		}
		this.closePromise = new Promise(resolve => {
			// this.closing prevents the worker from starting work on any new tasks
			this.closing = true
			if (this.fastPollHandle) {
				// Stop polling for jobs
				clearInterval(this.fastPollHandle)
			}
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
				resolve()
			} else {
				this.capacityEmitter.once('empty', () => {
					clearInterval(this.keepAlive)
					resolve()
				})
			}
		})
		return this.closePromise
	}

	public work = () => {
		this.logger.log(`Ready for ${this.taskType}...`)
		if (this.longPoll) {
			this.longPollLoop()
		} else {
			this.shortPollLoop()
			this.fastPollHandle = setInterval(
				() => this.shortPollLoop(),
				this.pollInterval
			)
		}
	}

	public completeJob(
		completeJobRequest: ZB.CompleteJobRequest
	): Promise<void> {
		const withStringifiedVariables = stringifyVariables(completeJobRequest)
		this.logger.debug(withStringifiedVariables)
		return this.gRPCClient.completeJobSync(withStringifiedVariables)
	}

	public onConnectionError(handler: (error: any) => void) {
		this.onConnectionErrorHandler = handler
	}

	public log(msg: any) {
		this.logger.log(msg)
	}

	public getNewLogger(options: ZB.ZBWorkerLoggerOptions) {
		return new ZBLogger({
			...options,
			id: this.id,
			taskType: this.taskType,
		})
	}

	private shortPollLoop() {
		if (this.fastPollInFlight) {
			return
		}
		this.fastPollInFlight = true
		const result = this.activateJobs()

		if (result.stream) {
			result.stream.on('end', () => {
				this.logger.debug('Fast poll stream end')
				this.fastPollInFlight = false
			})
		}
		if (result.atCapacity) {
			result.atCapacity.once(
				'available',
				() => (this.fastPollInFlight = false)
			)
		}
		if (result.error) {
			this.fastPollInFlight = true
		}
	}

	private longPollLoop() {
		const result = this.activateJobs()
		const start = Date.now()
		this.logger.debug('Long poll loop', Object.keys(result)[0], start)
		if (result.stream) {
			result.stream.on('end', () => {
				this.logger.debug(
					`Stream ended after ${(Date.now() - start) / 1000} seconds`
				)
				clearTimeout(this.restartPollingAfterLongPollTimeout!)
				this.longPollLoop()
			})
			result.stream.on('data', () => {
				this.logger.debug('Long poll loop on data')
				clearTimeout(this.restartPollingAfterLongPollTimeout!)
			})
			// We do this here because activateJobs may not result in an open gRPC call
			// for example, if the worker is at capacity or the worker is closing
			this.restartPollingAfterLongPollTimeout = setTimeout(
				() => this.longPollLoop,
				this.longPoll!
			)
		}
		if (result.atCapacity) {
			result.atCapacity.once('available', () => this.longPollLoop())
		}
		if (result.error) {
			setTimeout(() => this.longPollLoop(), 1000) // @TODO implement backoff
		}
	}

	private handleGrpcError = (err: any) => {
		if (!this.errored) {
			if (this.onConnectionErrorHandler) {
				this.onConnectionErrorHandler(err)
				this.errored = true
			} else {
				this.logger.error(`GRPC ERROR: ${err.message}`)
				this.errored = true
			}
		}
		if (this.longPoll) {
			this.logger.debug(`gRPC Error ${chalk.red(err.details)}`)
			this.logger.debug('Calling longPollLoop()')
			this.longPollLoop()
		}
	}

	private activateJobs() {
		if (this.closing) {
			return {
				closing: true,
			}
		}
		if (this.debug) {
			this.logger.debug('Activating Jobs')
		}
		let stream: any
		if (this.activeJobs >= this.maxActiveJobs) {
			this.logger.log(
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
		this.logger.debug(
			`Requesting ${amount} jobs with requestTimeout ${requestTimeout}`
		)

		try {
			stream = this.gRPCClient.activateJobsStream(activateJobsRequest)
			if (this.debug) {
				this.pollCount++
			}
		} catch (err) {
			this.handleGrpcError(err)
			return {
				error: true,
			}
		}

		stream.on('data', (res: ZB.ActivateJobsResponse) => {
			this.errored = false
			// If we are closing, don't start working on these jobs. They will have to be timed out by the server.
			if (this.closing) {
				return
			}
			const parsedVariables = res.jobs.map(parseVariables)
			this.activeJobs += parsedVariables.length
			// Call task handler for each new job
			parsedVariables.forEach(job => this.handleJob(job))
		})
		stream.on('error', (err: any) => this.handleGrpcError(err))
		return { stream }
	}

	private drainOne() {
		this.activeJobs--
		this.logger.debug(`Load: ${this.activeJobs}/${this.maxActiveJobs}`)
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
		/**
		 * Client-side timeout handler - removes jobs from the activeJobs count if timed out,
		 * prevents diminished capacity of this worker due to handler misbehaviour.
		 */
		let taskTimedout = false
		const taskId = uuid.v4()
		this.logger.debug(
			`Setting ${this.taskType} task timeout for ${taskId} to ${this.timeout}`
		)
		const timeoutCancel = setTimeout(() => {
			taskTimedout = true
			this.drainOne()
			this.logger.log(`Timed out task ${taskId} for ${this.taskType}`)
		}, this.timeout)

		// Any unhandled exception thrown by the user-supplied code will bubble up and throw here.
		// The task timeout handler above will deal with it.
		try {
			/**
			 * Construct the backward compatible worker callback
			 * See https://stackoverflow.com/questions/12766528/build-a-function-object-with-properties-in-typescript
			 * for an explanation of the pattern used.
			 *
			 * It is backward compatible because the old success handler is available as the function:
			 *  complete(variables?: object).
			 *
			 * The new API is available as
			 * complete.success(variables?: object) and complete.failure(errorMessage: string, retries?: number)
			 *
			 * To halt execution of the business process and raise an incident in Operate, call
			 * complete(errorMessage, 0)
			 */

			/**
			 * complete.success() handler
			 */
			const workerCallback = (() => {
				const shadowWorkerCallback = (completedVariables = {}) => {
					this.completeJob({
						jobKey: job.key,
						variables: completedVariables,
					})
					clearTimeout(timeoutCancel)
					if (!taskTimedout) {
						this.drainOne()
						this.logger.debug(
							`Completed task ${taskId} for ${this.taskType}`
						)
						return true
					} else {
						this.logger.debug(
							`Completed task ${taskId} for ${this.taskType}, however it had timed out.`
						)
						return false
					}
				}
				shadowWorkerCallback.success = shadowWorkerCallback
				/**
				 * complete.failure() handler
				 */
				shadowWorkerCallback.failure = async (
					errorMessage,
					retries = Math.max(0, job.retries - 1)
				) => {
					try {
						await this.zbClient.failJob({
							errorMessage,
							jobKey: job.key,
							retries,
						})
					} finally {
						this.logger.debug(
							`Failed job ${job.key} - ${errorMessage}`
						)
						this.drainOne()
						clearTimeout(timeoutCancel)
					}
				}
				return shadowWorkerCallback
			})()

			await this.taskHandler(
				{ ...job, customHeaders: { ...customHeaders } } as any,
				workerCallback,
				this
			)
		} catch (e) {
			clearTimeout(timeoutCancel)
			this.logger.error(
				`Caught an unhandled exception in a task handler for workflow instance ${job.workflowInstanceKey}:`
			)
			this.logger.debug(job)
			this.logger.error(e)

			if (this.cancelWorkflowOnException) {
				const { workflowInstanceKey } = job
				this.logger.debug(
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
				this.logger.info(`Failing job ${job.key}`)
				const retries = job.retries - 1
				try {
					this.zbClient.failJob({
						errorMessage: `Unhandled exception in task handler ${e}`,
						jobKey: job.key,
						retries,
					})
				} catch (e) {
					this.logger.debug(e)
				} finally {
					this.drainOne()
					if (retries > 0) {
						this.logger.debug(
							`The Zeebe engine will handle the retry. Retries left: ${retries}`
						)
					} else {
						this.logger.debug('No retries left for this task')
					}
				}
			}
		}
	}
}
