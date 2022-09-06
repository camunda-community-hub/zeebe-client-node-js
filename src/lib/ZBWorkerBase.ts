import { ClientReadableStreamImpl } from '@grpc/grpc-js/build/src/call'
import chalk, { Chalk } from 'chalk'
import * as _debug from 'debug'
import { EventEmitter } from 'events'
import { Duration, MaybeTimeDuration } from 'typed-duration'
import * as uuid from 'uuid'
import { parseVariablesAndCustomHeadersToJSON } from '../lib'
import * as ZB from '../lib/interfaces-1.0'
import { StatefulLogInterceptor } from '../lib/StatefulLogInterceptor'
import { ConnectionStatusEvent, ZBClient } from '../zb/ZBClient'
import {
	ActivateJobsRequest,
	ActivateJobsResponse,
} from './interfaces-grpc-1.0'
import { ZBClientOptions } from './interfaces-published-contract'
import { TypedEmitter } from './TypedEmitter'

const debug = _debug.default('worker')

const MIN_ACTIVE_JOBS_RATIO_BEFORE_ACTIVATING_JOBS = 0.3

const CapacityEvent = {
	Available: 'AVAILABLE',
	Empty: 'CAPACITY_EMPTY',
}

export interface ZBWorkerBaseConstructor<T> {
	grpcClient: ZB.ZBGrpc
	id: string | null
	taskType: string
	options: ZB.ZBWorkerOptions<T> & ZBClientOptions
	idColor: Chalk
	zbClient: ZBClient
	log: StatefulLogInterceptor
}

export interface ZBBatchWorkerConstructorConfig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends ZBWorkerBaseConstructor<WorkerInputVariables> {
	options: ZB.ZBWorkerOptions<WorkerInputVariables> &
		ZBClientOptions & { jobBatchMaxTime: number }
	taskHandler: ZB.ZBBatchWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
}

export interface ZBWorkerConstructorConfig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends ZBWorkerBaseConstructor<WorkerInputVariables> {
	taskHandler: ZB.ZBWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
}

export class ZBWorkerBase<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends TypedEmitter<typeof ConnectionStatusEvent> {
	private static readonly DEFAULT_JOB_ACTIVATION_TIMEOUT = Duration.seconds.of(
		60
	)
	private static readonly DEFAULT_MAX_ACTIVE_JOBS = 32
	public activeJobs = 0
	public grpcClient: ZB.ZBGrpc
	public maxJobsToActivate: number
	public jobBatchMinSize: number
	public taskType: string
	public timeout: MaybeTimeDuration
	public pollCount = 0
	protected zbClient: ZBClient
	protected logger: StatefulLogInterceptor
	protected taskHandler:
		| ZB.ZBBatchWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
		  >
		| ZB.ZBWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
		  >
	protected cancelWorkflowOnException = false
	private closeCallback?: () => void
	private closePromise?: Promise<null>
	private closing = false
	private closed = false
	private id = uuid.v4()
	private longPoll: MaybeTimeDuration
	private debugMode: boolean
	private capacityEmitter: EventEmitter
	private stalled = false
	private connected = true
	private readied = false
	private jobStream?: ClientReadableStreamImpl<any>
	private activeJobsThresholdForReactivation: number
	private pollInterval: MaybeTimeDuration
	private pollLoop: NodeJS.Timeout
	private pollMutex: boolean = false
	private backPressureRetryCount: number = 0
	private fetchVariable: (keyof WorkerInputVariables)[] | undefined

	constructor({
		grpcClient,
		id,
		log,
		options,
		taskHandler,
		taskType,
		zbClient,
	}:
		| ZBBatchWorkerConstructorConfig<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
		  >
		| ZBWorkerConstructorConfig<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
		  >) {
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
		this.maxJobsToActivate =
			options.maxJobsToActivate || ZBWorkerBase.DEFAULT_MAX_ACTIVE_JOBS
		this.activeJobsThresholdForReactivation =
			this.maxJobsToActivate *
			MIN_ACTIVE_JOBS_RATIO_BEFORE_ACTIVATING_JOBS
		this.jobBatchMinSize = Math.min(
			options.jobBatchMinSize ?? 0,
			this.maxJobsToActivate
		)
		this.timeout =
			options.timeout || ZBWorkerBase.DEFAULT_JOB_ACTIVATION_TIMEOUT

		this.pollInterval = options.pollInterval!
		this.longPoll = options.longPoll!
		this.pollInterval = options.pollInterval!
		this.id = id || uuid.v4()
		// Set options.debug to true to count the number of poll requests for testing
		// See the Worker-LongPoll test
		this.debugMode = options.debug === true
		this.grpcClient = grpcClient
		const onError = () => {
			// options.onConnectionError?.()

			if (this.connected) {
				this.emit(ConnectionStatusEvent.connectionError)
				options.onConnectionError?.()
				this.connected = false
				this.readied = false
			}
		}
		this.grpcClient.on(ConnectionStatusEvent.connectionError, onError)
		const onReady = async () => {
			if (!this.readied) {
				this.emit(ConnectionStatusEvent.ready)
				options.onReady?.()
				this.readied = true
				this.connected = true
			}
		}
		this.grpcClient.on(ConnectionStatusEvent.unknown, onReady)
		this.grpcClient.on(ConnectionStatusEvent.ready, onReady)
		this.cancelWorkflowOnException =
			options.failWorkflowOnException ??
			options.failProcessOnException ??
			false
		this.zbClient = zbClient
		this.grpcClient.topologySync().catch(e => {
			// Swallow exception to avoid throwing if retries are off
			if (e.thisWillNeverHappenYo) {
				this.emit(ConnectionStatusEvent.unknown)
			}
		})

		this.fetchVariable = options.fetchVariable

		this.logger = log
		this.capacityEmitter = new EventEmitter()

		this.pollLoop = setInterval(
			() => this.poll(),
			Duration.milliseconds.from(this.pollInterval)
		)
	}

	/**
	 * Returns a promise that the worker has stopped accepting tasks and
	 * has drained all current active tasks. Will reject if you try to call it more than once.
	 */
	public close(timeout?: number): Promise<null> {
		if (this.closePromise) {
			return this.closePromise
		}
		this.closePromise = new Promise(async resolve => {
			// this.closing prevents the worker from starting work on any new tasks
			this.closing = true
			clearInterval(this.pollLoop)

			if (this.activeJobs <= 0) {
				await this.grpcClient.close(timeout)
				this.grpcClient.removeAllListeners()
				this.jobStream?.cancel?.()
				this.jobStream = undefined
				this.logger.logDebug('Cancelled Job Stream')
				resolve(null)
			} else {
				this.capacityEmitter.once(CapacityEvent.Empty, async () => {
					await this.grpcClient.close(timeout)
					this.grpcClient.removeAllListeners()
					this.emit(ConnectionStatusEvent.close)
					this.removeAllListeners()
					resolve(null)
				})
			}
		})
		return this.closePromise
	}

	public log(msg: any) {
		this.logger.logInfo(msg)
	}

	public debug(msg: any) {
		this.logger.logDebug(msg)
	}

	public error(msg: any) {
		this.logger.logError(msg)
	}

	protected drainOne() {
		this.activeJobs--
		this.logger.logDebug(
			`Load: ${this.activeJobs}/${this.maxJobsToActivate}`
		)

		const hasSufficientAvailableCapacityToRequestMoreJobs =
			this.activeJobs <= this.activeJobsThresholdForReactivation
		if (!this.closing && hasSufficientAvailableCapacityToRequestMoreJobs) {
			this.capacityEmitter.emit(CapacityEvent.Available)
		}
		if (this.closing && this.activeJobs === 0) {
			this.capacityEmitter.emit(CapacityEvent.Empty)
		}
		// If we are closing and hit zero active jobs, resolve the closing promise.
		if (this.activeJobs <= 0 && this.closing) {
			if (this.closeCallback && !this.closed) {
				this.closeCallback()
			}
		}
	}

	protected handleJobs(_: ZB.Job[]) {
		this.log(
			`This method must be declared in a class that extends this base`
		)
	}

	protected makeCompleteHandlers<T>(
		thisJob: ZB.Job
	): ZB.CompleteFn<T> & ZB.JobCompletionInterface<T> {
		let methodCalled: string | undefined
		const errorMsgOnPriorMessageCall = (
			thisMethod: string,
			wrappedFunction: any
		) => {
			return (...args) => {
				if (methodCalled !== undefined) {
					// tslint:disable-next-line: no-console
					console.log(
						chalk.red(`WARNING: Call to ${thisMethod}() after ${methodCalled}() was called.
You should call only one job action method in the worker handler. This is a bug in the ${this.taskType} worker handler.`)
					)
					// tslint:disable-next-line: no-console
					console.log('handler', this.taskHandler.toString()) // @DEBUG

					return wrappedFunction(...args)
				}
				methodCalled = thisMethod
				return wrappedFunction(...args)
			}
		}
		const cancelWorkflow = (job: ZB.Job) => () =>
			this.zbClient
				.cancelProcessInstance(job.processInstanceKey)
				.then(() => ZB.JOB_ACTION_ACKNOWLEDGEMENT)

		const failJob = (job: ZB.Job) => (
			errorMessageOrFailureConfig: string | ZB.JobFailureConfiguration,
			retries?: number
		) => {
			const errorMessage =
				typeof errorMessageOrFailureConfig === 'string'
					? errorMessageOrFailureConfig
					: (errorMessageOrFailureConfig as ZB.JobFailureConfiguration)
							.errorMessage
			const retryBackOff =
				typeof errorMessageOrFailureConfig === 'string'
					? 0
					: (errorMessageOrFailureConfig as ZB.JobFailureConfiguration)
							.retryBackOff ?? 0
			return this.failJob({ job, errorMessage, retries, retryBackOff })
		}

		const succeedJob = (job: ZB.Job) => (completedVariables?: T) =>
			this.completeJob(job.key, completedVariables ?? {})

		const errorJob = (job: ZB.Job) => (
			errorCode: string,
			errorMessage: string = ''
		) =>
			this.errorJob({
				errorCode,
				errorMessage,
				job,
			})
		const fail = failJob(thisJob)
		const succeed = succeedJob(thisJob)
		return {
			cancelWorkflow: cancelWorkflow(thisJob),
			complete: errorMsgOnPriorMessageCall('job.complete', succeed),
			error: errorMsgOnPriorMessageCall('error', errorJob(thisJob)),
			fail: errorMsgOnPriorMessageCall('job.fail', fail),
			failure: errorMsgOnPriorMessageCall('complete.failure', fail),
			forward: errorMsgOnPriorMessageCall('job.forward', () => {
				this.drainOne()
				return ZB.JOB_ACTION_ACKNOWLEDGEMENT
			}),
			forwarded: errorMsgOnPriorMessageCall('complete.forwarded', () => {
				this.drainOne()
				return ZB.JOB_ACTION_ACKNOWLEDGEMENT
			}),
			success: errorMsgOnPriorMessageCall('complete.success', succeed),
		}
	}

	private failJob({
		job,
		errorMessage,
		retries,
		retryBackOff,
	}: {
		job: ZB.Job
		errorMessage: string
		retries?: number
		retryBackOff?: number
	}) {
		return this.zbClient
			.failJob({
				errorMessage,
				jobKey: job.key,
				retries: retries ?? job.retries - 1,
				retryBackOff: retryBackOff ?? 0,
			})
			.then(() => ZB.JOB_ACTION_ACKNOWLEDGEMENT)
			.finally(() => {
				this.logger.logDebug(`Failed job ${job.key} - ${errorMessage}`)
				this.drainOne()
			})
	}

	private completeJob(jobKey: string, completedVariables = {}) {
		return this.zbClient
			.completeJob({
				jobKey,
				variables: completedVariables,
			})
			.then(res => {
				this.logger.logDebug(
					`Completed job ${jobKey} for ${this.taskType}`
				)
				return res
			})
			.catch(e => {
				this.logger.logDebug(
					`Completing job ${jobKey} for ${this.taskType} threw ${e.message}`
				)
				return e
			})
			.then(() => ZB.JOB_ACTION_ACKNOWLEDGEMENT)
			.finally(() => {
				this.drainOne()
			})
	}

	private errorJob({
		errorCode,
		errorMessage,
		job,
	}: {
		job: ZB.Job
		errorCode: string
		errorMessage: string
	}) {
		return this.zbClient
			.throwError({
				errorCode,
				errorMessage,
				jobKey: job.key,
			})
			.then(() =>
				this.logger.logDebug(`Errored job ${job.key} - ${errorMessage}`)
			)
			.catch(e => {
				this.logger.logError(
					`Exception while attempting to raise BPMN Error for job ${job.key} - ${errorMessage}`
				)
				this.logger.logError(e)
			})
			.then(() => {
				this.drainOne()
				return ZB.JOB_ACTION_ACKNOWLEDGEMENT
			})
	}

	private handleStreamEnd = id => {
		this.jobStream = undefined
		this.logger.logDebug(
			`Deleted job stream [${id}] listeners and job stream reference`
		)
	}

	private async poll() {
		const pollAlreadyInProgress =
			this.pollMutex || this.jobStream !== undefined
		const workerIsClosing = this.closePromise !== undefined || this.closing
		const insufficientCapacityAvailable =
			this.activeJobs > this.activeJobsThresholdForReactivation

		if (
			pollAlreadyInProgress ||
			workerIsClosing ||
			insufficientCapacityAvailable
		) {
			return
		}

		this.pollMutex = true
		debug('Polling...')
		this.logger.logDebug('Activating Jobs...')
		const id = uuid.v4()
		const jobStream = await this.activateJobs(id)
		const start = Date.now()
		this.logger.logDebug(
			`Long poll loop. this.longPoll: ${Duration.value.of(
				this.longPoll
			)}`,
			id,
			start
		)

		if (jobStream.stream) {
			this.logger.logDebug(`Stream [${id}] opened...`)
			this.jobStream = jobStream.stream
			// This event happens when the server cancels the call after the deadline
			// And when it has completed a response with work
			jobStream.stream.on('end', () => {
				this.logger.logDebug(
					`Stream [${id}] ended after ${(Date.now() - start) /
						1000} seconds`
				)
				this.handleStreamEnd(id)
				this.backPressureRetryCount = 0
			})

			jobStream.stream.on('error', error => {
				this.logger.logDebug(
					`Stream [${id}] error after ${(Date.now() - start) /
						1000} seconds`,
					error
				)
				if (error.code === 8) {
					setTimeout(
						() => this.handleStreamEnd(id),
						1000 * 2 ** this.backPressureRetryCount++
					)
				} else {
					this.handleStreamEnd(id)
				}
			})
		}

		if (jobStream.error) {
			const error = (jobStream.error as any)?.message
			this.logger.logError({ id, error })
		}
		this.pollMutex = false
	}

	private async activateJobs(id: string) {
		if (this.stalled) {
			return { stalled: true }
		}
		if (this.closing) {
			return {
				closing: true,
			}
		}
		if (this.debugMode) {
			this.logger.logDebug(`Activating Jobs...`)
		}
		debug('Activating Jobs')
		let stream: any

		const amount = this.maxJobsToActivate - this.activeJobs

		const requestTimeout = this.longPoll || -1

		const activateJobsRequest: ActivateJobsRequest = {
			maxJobsToActivate: amount,
			requestTimeout,
			timeout: this.timeout,
			type: this.taskType,
			worker: this.id,
			fetchVariable: this.fetchVariable as string[],
		}

		this.logger.logDebug(
			`Requesting ${amount} jobs on [${id}] with requestTimeout ${Duration.value.of(
				requestTimeout
			)}, job timeout: ${Duration.value.of(this.timeout)}`
		)
		debug(
			`Requesting ${amount} jobs on [${id}] with requestTimeout ${Duration.value.of(
				requestTimeout
			)}, job timeout: ${Duration.value.of(this.timeout)}`
		)

		try {
			stream = await this.grpcClient.activateJobsStream(
				activateJobsRequest
			)
			if (this.debugMode) {
				this.pollCount++
			}
		} catch (error) {
			return {
				error,
			}
		}

		if (stream.error) {
			return { error: stream.error }
		}

		stream.on('data', this.handleJobResponse)
		return { stream }
	}

	private handleJobResponse = (res: ActivateJobsResponse) => {
		// If we are closing, don't start working on these jobs. They will have to be timed out by the server.
		if (this.closing) {
			return
		}
		this.activeJobs += res.jobs.length

		const jobs = res.jobs.map(job =>
			parseVariablesAndCustomHeadersToJSON<
				WorkerInputVariables,
				CustomHeaderShape
			>(job)
		)
		this.handleJobs(jobs)
	}
}
