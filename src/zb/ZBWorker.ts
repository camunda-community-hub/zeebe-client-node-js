import chalk, { Chalk } from 'chalk'
import { EventEmitter } from 'events'
import * as uuid from 'uuid'
import { parseVariables, stringifyVariables } from '../lib'
import * as ZB from '../lib/interfaces'
import { ZBLogger } from '../lib/ZBLogger'
import { ZBClient } from './ZBClient'
const TEN_MINUTES = 60000

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
	private pollHandle?: NodeJS.Timeout
	private pollInterval: number
	private taskHandler: ZB.ZBWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
	private cancelWorkflowOnException = false
	private zbClient: ZBClient
	private logger: ZBLogger
	private longPoll: boolean
	private debug: boolean
	private restartPollingAfterLongPollTimeout?: NodeJS.Timeout
	private capacityEmitter: EventEmitter

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
		this.longPoll = options.longPoll === true
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
			stdout: options.stdout || console,
			taskType: this.taskType,
		})
		this.capacityEmitter = new EventEmitter()
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
			if (this.pollHandle) {
				// Stop polling for jobs
				clearInterval(this.pollHandle)
			}
			if (this.restartPollingAfterLongPollTimeout) {
				clearTimeout(this.restartPollingAfterLongPollTimeout)
			}
			// We will resolve the Promise in any case at two seconds over the worker timeout period.
			// This deals with phantom tasks, which will have timed out on the server.
			const closeTimeout = setTimeout(resolve, this.timeout + 2000)
			// If we have no active tasks right now, resolve immediately.
			// There could be a race condition here if we just polled the server and it is about to return jobs.
			// In any case, we do not start working on those jobs, so they will time out on the server.
			if (this.activeJobs <= 0) {
				resolve()
			}
			// When this.activeJobs reaches 0, this will resolve the promise to close. Called in this.drainOne().
			this.closeCallback = () => {
				clearTimeout(closeTimeout)
				this.closed = true
				resolve()
			}
		})
		return this.closePromise
	}

	public work = () => {
		this.logger.log(`Ready for ${this.taskType}...`)
		if (!this.longPoll) {
			this.shortPollLoop()
			this.activateJobs()
		} else {
			this.longPollLoop()
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
		this.pollHandle = setInterval(
			() => this.activateJobs(),
			this.pollInterval
		)
	}

	private longPollLoop() {
		const result = this.activateJobs()

		if (result.stream) {
			result.stream.on('data', () => {
				clearTimeout(this.restartPollingAfterLongPollTimeout!)
				this.longPollLoop()
			})
			this.restartPollingAfterLongPollTimeout = setTimeout(
				() => this.longPollLoop,
				TEN_MINUTES
			)
		}
		if (result.atCapacity) {
			result.atCapacity.once('available', () => this.longPollLoop())
		}
		if (result.error) {
			setTimeout(() => this.longPollLoop(), 1000) // @TODO implement backoff
		}
	}

	private internalLog = (ns: string) => (msg: any) =>
		// tslint:disable-next-line:no-console
		console.log(`${ns}:`, msg)

	private handleGrpcError = (err: any) => {
		if (!this.errored) {
			if (this.onConnectionErrorHandler) {
				this.onConnectionErrorHandler(err)
				this.errored = true
			} else {
				this.internalLog(
					chalk.red(`ERROR: `) +
						chalk.yellow(`${this.id} - ${this.taskType}`)
				)(chalk.red(err.details))
				this.errored = true
			}
		}
	}

	private activateJobs() {
		if (this.debug) {
			this.logger.debug('Activating Jobs')
		}
		/**
		 * It would be good to use a mutex to prevent multiple overlapping polling invocations.
		 * However, the stream.on("data") is only called when there are jobs, so it there isn't an obvious (to me)
		 * way to release the mutex.
		 */
		let stream: any
		if (this.activeJobs >= this.maxActiveJobs) {
			this.logger.log(
				`Polling cancelled - ${this.taskType} has ${this.activeJobs} and a capacity of ${this.maxActiveJobs}.`
			)
			return { atCapacity: this.capacityEmitter }
		}

		const amount = this.maxActiveJobs - this.activeJobs

		const activateJobsRequest: ZB.ActivateJobsRequest = {
			maxJobsToActivate: amount,
			timeout: this.timeout,
			type: this.taskType,
			worker: this.id,
		}

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

		const taskHandler = this.taskHandler
		stream.on('data', (res: ZB.ActivateJobsResponse) => {
			// If we are closing, don't start working on these jobs. They will have to be timed out by the server.
			if (this.closing) {
				return
			}
			const parsedVariables = res.jobs.map(parseVariables)
			this.activeJobs += parsedVariables.length
			// Call task handler for each new job
			parsedVariables.forEach(async (job: ZB.ActivatedJob) => {
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
					this.logger.log(
						`Timed out task ${taskId} for ${this.taskType}`
					)
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
					const workerCallback = (() => {
						const shadowWorkerCallback = (
							completedVariables = {}
						) => {
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
						shadowWorkerCallback.failure = (
							errorMessage,
							retries = Math.max(0, job.retries - 1)
						) => {
							this.zbClient.failJob({
								errorMessage,
								jobKey: job.key,
								retries,
							})
							this.logger.debug(
								`Failed job ${job.key} - ${errorMessage}`
							)
							clearTimeout(timeoutCancel)
						}
						return shadowWorkerCallback
					})()

					await taskHandler(
						{ ...job, customHeaders: { ...customHeaders } } as any,
						workerCallback,
						this
					)
				} catch (e) {
					this.logger.error(
						'Caught an unhandled exception in a task handler:'
					)
					this.logger.error(e)
					this.logger.info(`Failing job ${job.key}`)
					const retries = job.retries - 1
					this.zbClient.failJob({
						errorMessage: `Unhandled exception in task handler ${e}`,
						jobKey: job.key,
						retries,
					})

					if (this.cancelWorkflowOnException) {
						const workflowInstanceKey = job.workflowInstanceKey
						this.logger.debug(
							`Cancelling workflow ${workflowInstanceKey}`
						)
						this.drainOne()
						this.zbClient.cancelWorkflowInstance(
							workflowInstanceKey
						)
					} else {
						if (retries > 0) {
							this.logger.debug(
								`The Zeebe engine will handle the retry. Retries left: ${retries}`
							)
						} else {
							this.logger.debug('No retries left for this task')
						}
					}
				}
			})
		})
		stream.on('error', (err: any) => this.handleGrpcError(err))
		return { stream }
	}

	private drainOne() {
		this.activeJobs--
		if (!this.closing && this.longPoll) {
			this.capacityEmitter.emit('available')
		}
		// If we are closing and hit zero active jobs, resolve the closing promise.
		if (this.activeJobs <= 0 && this.closing) {
			if (this.closeCallback && !this.closed) {
				this.closeCallback()
			}
		}
	}
}
