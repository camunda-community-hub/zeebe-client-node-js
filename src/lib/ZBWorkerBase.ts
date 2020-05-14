import { ClientReadableStreamImpl } from '@grpc/grpc-js/build/src/call'
import { Chalk } from 'chalk'
import { EventEmitter } from 'events'
import { Duration, MaybeTimeDuration } from 'typed-duration'
import * as uuid from 'uuid'
import { parseVariablesAndCustomHeadersToJSON } from '../lib'
import * as ZB from '../lib/interfaces'
import { StatefulLogInterceptor } from '../lib/StatefulLogInterceptor'
import { ConnectionStatusEvent, ZBClient } from '../zb/ZBClient'
import { ActivateJobsRequest, ActivateJobsResponse } from './interfaces-grpc'
import { ZBClientOptions } from './interfaces-published-contract'

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
> extends EventEmitter {
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
	private closePromise?: Promise<undefined>
	private closing = false
	private closed = false
	private id = uuid.v4()
	private longPoll: MaybeTimeDuration
	private debugMode: boolean
	private restartPollingAfterLongPollTimeout?: NodeJS.Timeout
	private capacityEmitter: EventEmitter
	private keepAlive: NodeJS.Timer
	// Used to prevent worker from exiting when no timers active
	private alivenessBit: number = 0
	private stalled = false
	private connected = true
	private readied = false
	private jobStreams: { [key: string]: ClientReadableStreamImpl<any> } = {}
	private restartPollingAfterStall?: NodeJS.Timeout

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
		this.jobBatchMinSize = Math.min(
			options.jobBatchMinSize ?? 0,
			this.maxJobsToActivate
		)
		this.timeout =
			options.timeout || ZBWorkerBase.DEFAULT_JOB_ACTIVATION_TIMEOUT

		this.longPoll = options.longPoll!
		this.id = id || uuid.v4()
		// Set options.debug to true to count the number of poll requests for testing
		// See the Worker-LongPoll test
		this.debugMode = options.debug === true
		this.grpcClient = grpcClient
		const onError = () => {
			options.onConnectionError?.()

			if (this.connected) {
				this.emit(ConnectionStatusEvent.ConnectionError)
				options.onConnectionError?.()
				this.connected = false
				this.readied = false
				this.stall()
			}
		}
		this.grpcClient.on(ConnectionStatusEvent.ConnectionError, onError)
		const onReady = async () => {
			if (!this.readied) {
				this.emit(ConnectionStatusEvent.Ready)
				options.onReady?.()
				this.readied = true
				this.connected = true
			}
		}
		this.grpcClient.on(ConnectionStatusEvent.Ready, onReady)
		this.cancelWorkflowOnException =
			options.failWorkflowOnException || false
		this.zbClient = zbClient
		this.grpcClient.topologySync().catch(e => {
			// Swallow exception to avoid throwing if retries are off
			if (e.thisWillNeverHappenYo) {
				this.emit('never')
			}
		})

		this.logger = log

		this.capacityEmitter = new EventEmitter()
		// With long polling there are periods where no timers are running. This prevents the worker exiting.
		this.keepAlive = setInterval(() => {
			this.alivenessBit = (this.alivenessBit + 1) % 1
		}, 10000)
		this.grpcClient.on(ConnectionStatusEvent.ConnectionError, () =>
			this.stall()
		)
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

			if (this.activeJobs <= 0) {
				clearInterval(this.keepAlive)
				await this.grpcClient.close(timeout)
				this.grpcClient.removeAllListeners()
				Object.keys(this.jobStreams).forEach(key => {
					this.jobStreams[key]?.removeAllListeners?.()
					this.jobStreams[key]?.cancel?.()
					delete this.jobStreams[key]
					this.logger.logDebug('Removed Job Stream Listeners')
				})
				resolve()
			} else {
				this.capacityEmitter.once(CapacityEvent.Empty, async () => {
					clearInterval(this.keepAlive)
					await this.grpcClient.close(timeout)
					this.grpcClient.removeAllListeners()
					this.emit('close')
					this.removeAllListeners()
					resolve()
				})
			}
		})
		return this.closePromise
	}

	public work = () => {
		this.logger.logInfo(`Ready for ${this.taskType}...`)
		this.grpcClient.once(ConnectionStatusEvent.Ready, () => {
			this.logger.logDebug(`Fired backup start work event.`)
			this.stalled = false
			this.longPollLoop()
		})
		this.longPollLoop()
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
		if (!this.closing && this.activeJobs < this.maxJobsToActivate * 0.75) {
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

	protected makeCompleteHandlers<T>(thisJob: ZB.Job): ZB.CompleteFn<T> {
		const failJob = (job: ZB.Job) => (
			errorMessage: string,
			retries?: number
		) => this.failJob({ job, errorMessage, retries })

		const succeedJob = (job: ZB.Job) => (completedVariables?: Partial<T>) =>
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
		return {
			error: errorJob(thisJob),
			failure: failJob(thisJob),
			forwarded: () => this.drainOne(),
			success: succeedJob(thisJob),
		}
	}

	private failJob({
		job,
		errorMessage,
		retries,
	}: {
		job: ZB.Job
		errorMessage: string
		retries?: number
	}) {
		this.zbClient
			.failJob({
				errorMessage,
				jobKey: job.key,
				retries: retries ?? job.retries - 1,
			})
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
			.then(() => this.drainOne())
	}

	private stall() {
		if (this.restartPollingAfterStall) {
			return
		}
		this.stalled = true
		this.logger.logError(`Stalled on Grpc Error`)

		const timeout = 5000 // Duration.milliseconds.from(this.longPoll) + 100
		this.logger.logDebug(`Stalled. Setting timeout to ${timeout}`)
		this.restartPollingAfterStall = setTimeout(() => {
			this.stalled = false
			this.restartPollingAfterStall = undefined
			this.logger.logDebug(`Restart after stall timer fired ${timeout}`)
			this.longPollLoop()
		}, timeout)

		// this.grpcClient.once(ConnectionStatusEvent.Ready, () => {
		// 	this.stalled = false
		// 	this.longPollLoop()
		// })
	}

	private async longPollLoop() {
		if (this.closePromise) {
			return
		}
		this.logger.logDebug('Activating Jobs...')
		const jobStream = await this.activateJobs()
		const id = uuid.v4()
		const start = Date.now()
		this.logger.logDebug(
			`Long poll loop. this.longPoll: ${Duration.value.of(
				this.longPoll
			)}`,
			Object.keys(jobStream!)[0],
			start
		)

		if (jobStream.stream) {
			this.logger.logDebug('Stream opened...')
			this.jobStreams[id] = jobStream.stream
			// This event happens when the server cancels the call after the deadline
			// And when it has completed a response with work
			jobStream.stream.on?.('end', () => {
				this.logger.logDebug(
					`Stream ended after ${(Date.now() - start) / 1000} seconds`
				)
				clearTimeout(this.restartPollingAfterLongPollTimeout!)
				this.jobStreams[id].removeAllListeners()
				delete this.jobStreams[id]
				this.longPollLoop()
			})
			// We do this here because activateJobs may not result in an open gRPC call
			// for example, if the worker is at capacity
			if (!this.closing) {
				const timeout = Duration.milliseconds.from(this.longPoll) + 100
				this.logger.logDebug(`Setting timeout to ${timeout}`)
				this.restartPollingAfterLongPollTimeout = setTimeout(() => {
					this.logger.logDebug(`Timer fired ${timeout}`)
					this.longPollLoop()
				}, timeout)
			}
		}
		if (jobStream.atCapacity) {
			jobStream.atCapacity.once(CapacityEvent.Available, () =>
				this.longPollLoop()
			)
		}
		if (jobStream.error) {
			this.logger.logError(jobStream.error.message)
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
		if (this.debugMode) {
			this.logger.logDebug('Activating Jobs')
		}
		let stream: any
		if (this.activeJobs >= this.maxJobsToActivate - this.jobBatchMinSize) {
			this.logger.logInfo(
				`Worker at max capacity - ${this.taskType} has ${this.activeJobs}, a capacity of ${this.maxJobsToActivate}, and a minimum job batch size of ${this.jobBatchMinSize}.`
			)
			return { atCapacity: this.capacityEmitter }
		}

		const amount = this.maxJobsToActivate - this.activeJobs

		const requestTimeout = this.longPoll || -1

		const activateJobsRequest: ActivateJobsRequest = {
			maxJobsToActivate: amount,
			requestTimeout,
			timeout: this.timeout,
			type: this.taskType,
			worker: this.id,
		}
		this.logger.logDebug(
			`Requesting ${amount} jobs with requestTimeout ${Duration.value.of(
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

		stream.on('data', (res: ActivateJobsResponse) => {
			// If we are closing, don't start working on these jobs. They will have to be timed out by the server.
			if (this.closing) {
				return
			}
			const jobs = res.jobs.map(job =>
				parseVariablesAndCustomHeadersToJSON<
					WorkerInputVariables,
					CustomHeaderShape
				>(job)
			)
			this.activeJobs += jobs.length
			this.handleJobs(jobs)
		})
		return { stream }
	}
}
