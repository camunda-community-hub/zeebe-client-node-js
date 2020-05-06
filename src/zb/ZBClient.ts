import chalk from 'chalk'
import { EventEmitter } from 'events'
import { either as E } from 'fp-ts'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import { pipe } from 'fp-ts/lib/pipeable'
import * as path from 'path'
import promiseRetry from 'promise-retry'
import { Duration, MaybeTimeDuration } from 'typed-duration'
import { v4 as uuid } from 'uuid'
import {
	BpmnParser,
	parseVariables,
	parseVariablesAndCustomHeadersToJSON,
	stringifyVariables,
} from '../lib'
import { ConfigurationHydrator } from '../lib/ConfigurationHydrator'
import { ConnectionFactory } from '../lib/ConnectionFactory'
import { readDefinitionFromFile } from '../lib/deployWorkflow/impure'
import { bufferOrFiles, mapThese } from '../lib/deployWorkflow/pure'
import * as ZB from '../lib/interfaces'
// tslint:disable-next-line: no-duplicate-imports
import {
	CreateWorkflowInstance,
	CreateWorkflowInstanceWithResult,
} from '../lib/interfaces'
import * as Grpc from '../lib/interfaces-grpc'
import {
	Loglevel,
	ZBClientOptions,
	ZBCustomLogger,
} from '../lib/interfaces-published-contract'
import { OAuthProvider, OAuthProviderConfig } from '../lib/OAuthProvider'
import { ZBSimpleLogger } from '../lib/SimpleLogger'
import { StatefulLogInterceptor } from '../lib/StatefulLogInterceptor'
import { Utils } from '../lib/utils'
import { ZBJsonLogger } from '../lib/ZBJsonLogger'
import { decodeCreateZBWorkerSig } from '../lib/ZBWorkerSignature'
import { ZBBatchWorker } from './ZBBatchWorker'
import { ZBWorker } from './ZBWorker'

const idColors = [
	chalk.yellow,
	chalk.green,
	chalk.cyan,
	chalk.magenta,
	chalk.blue,
]

export const ConnectionStatusEvent = {
	ConnectionError: 'connectionError' as 'connectionError',
	Ready: 'ready' as 'ready',
}

export class ZBClient extends EventEmitter {
	public static readonly DEFAULT_CONNECTION_TOLERANCE = Duration.milliseconds.of(
		3000
	)
	private static readonly DEFAULT_MAX_RETRIES = 50
	private static readonly DEFAULT_MAX_RETRY_TIMEOUT = Duration.seconds.of(5)
	private static readonly DEFAULT_LONGPOLL_PERIOD = Duration.seconds.of(30)
	public connectionTolerance: MaybeTimeDuration = process.env
		.ZEEBE_CONNECTION_TOLERANCE
		? parseInt(process.env.ZEEBE_CONNECTION_TOLERANCE, 10)
		: ZBClient.DEFAULT_CONNECTION_TOLERANCE
	public connected?: boolean = undefined
	public readied = false
	public gatewayAddress: string
	public loglevel: Loglevel
	public onReady?: () => void
	public onConnectionError?: () => void
	private logger: StatefulLogInterceptor
	private closePromise?: Promise<any>
	private closing = false
	// A gRPC channel for the ZBClient to execute commands on
	private grpc: ZB.ZBGrpc
	private options: ZBClientOptions
	private workerCount = 0
	private workers: Array<
		ZBWorker<any, any, any> | ZBBatchWorker<any, any, any>
	> = []
	private retry: boolean
	private maxRetries: number
	private maxRetryTimeout: MaybeTimeDuration
	private oAuth?: OAuthProvider
	private basicAuth?: ZB.BasicAuthConfig
	private useTLS: boolean
	private stdout: ZBCustomLogger

	/**
	 *
	 * @param options Zero-conf constructor. The entire ZBClient connection config can be passed in via the environment.
	 */
	constructor(options?: ZBClientOptions)
	constructor(gatewayAddress: string, options?: ZBClientOptions)
	constructor(
		gatewayAddress?: string | ZBClientOptions,
		options?: ZBClientOptions
	) {
		super()
		if (typeof gatewayAddress === 'object') {
			options = gatewayAddress
			gatewayAddress = undefined
		}

		const opts = options ? options : {}
		this.options = {
			longPoll: ZBClient.DEFAULT_LONGPOLL_PERIOD,
			...opts,
			retry: (opts as any).retry !== false,
		}
		this.options.loglevel =
			(process.env.ZEEBE_NODE_LOG_LEVEL as Loglevel) ||
			this.options.loglevel ||
			'INFO'
		this.loglevel = this.options.loglevel

		const logTypeFromEnvironment = () =>
			({
				JSON: ZBJsonLogger,
				SIMPLE: ZBSimpleLogger,
			}[process.env.ZEEBE_NODE_LOG_TYPE || 'NONE'])

		this.options.stdout =
			this.options.stdout || logTypeFromEnvironment() || ZBSimpleLogger
		this.stdout = this.options.stdout!

		this.options = ConfigurationHydrator.configure(
			gatewayAddress,
			this.options
		)

		this.gatewayAddress = `${this.options.hostname}:${this.options.port}`

		this.oAuth = this.options.oAuth
			? new OAuthProvider(
					this.options.oAuth as OAuthProviderConfig & {
						cacheDir: string
						cacheOnDisk: boolean
					}
			  )
			: undefined
		this.useTLS =
			this.options.useTLS === true ||
			(!!this.options.oAuth && this.options.useTLS !== false)
		this.basicAuth = this.options.basicAuth
		this.connectionTolerance = Duration.milliseconds.from(
			this.options.connectionTolerance || this.connectionTolerance
		)
		this.onConnectionError = this.options.onConnectionError
		this.onReady = this.options.onReady
		const { grpcClient, log } = this.constructGrpcClient({
			grpcConfig: {
				namespace: this.options.logNamespace || 'ZBClient',
			},
			logConfig: {
				_tag: 'ZBCLIENT',
				loglevel: this.loglevel,
				namespace: this.options.logNamespace || 'ZBClient',
				pollInterval: this.options.longPoll
					? Duration.milliseconds.from(this.options.longPoll)
					: undefined,
				stdout: this.stdout,
			},
		})

		grpcClient.on(ConnectionStatusEvent.ConnectionError, () => {
			if (this.connected !== false) {
				this.onConnectionError?.()
				this.emit(ConnectionStatusEvent.ConnectionError)
			}
			this.connected = false
			this.readied = false
		})
		grpcClient.on(ConnectionStatusEvent.Ready, () => {
			if (!this.readied) {
				this.onReady?.()
				this.emit(ConnectionStatusEvent.Ready)
			}
			this.connected = true
			this.readied = true
		})
		this.grpc = grpcClient
		this.logger = log

		this.retry = this.options.retry !== false
		this.maxRetries =
			this.options.maxRetries || ZBClient.DEFAULT_MAX_RETRIES
		this.maxRetryTimeout =
			this.options.maxRetryTimeout || ZBClient.DEFAULT_MAX_RETRY_TIMEOUT
		// Send command to broker to eagerly fail / prove connection.
		// This is useful for, for example: the Node-Red client, which wants to
		// display the connection status.
		if (!!this.options.eagerConnection) {
			this.topology()
				.then(res => {
					this.logger.logDirect(
						chalk.blueBright('Zeebe cluster topology:')
					)
					this.logger.logDirect(res.brokers)
				})
				.catch(e => {
					// Swallow exception to avoid throwing if retries are off
					if (e.thisWillNeverHappenYo) {
						this.emit('never')
					}
				})
		}
	}

	public activateJobs<
		Variables = ZB.KeyedObject,
		CustomHeaders = ZB.KeyedObject
	>(request: Grpc.ActivateJobsRequest): Promise<ZB.Job[]> {
		return new Promise(async (resolve, reject) => {
			try {
				const stream = await this.grpc.activateJobsStream(request)
				stream.on('data', (res: Grpc.ActivateJobsResponse) => {
					const jobs = res.jobs.map(job =>
						parseVariablesAndCustomHeadersToJSON<
							Variables,
							CustomHeaders
						>(job)
					)

					resolve(jobs)
				})
			} catch (e) {
				reject(e)
			}
		})
	}

	public async cancelWorkflowInstance(
		workflowInstanceKey: string | number
	): Promise<void> {
		Utils.validateNumber(workflowInstanceKey, 'workflowInstanceKey')
		return this.executeOperation('cancelWorkflowInstance', () =>
			this.grpc.cancelWorkflowInstanceSync({
				workflowInstanceKey,
			})
		)
	}

	public createBatchWorker<
		WorkerInputVariables = ZB.InputVariables,
		CustomHeaderShape = ZB.CustomHeaders,
		WorkerOutputVariables = ZB.OutputVariables
	>(
		conf: ZB.ZBBatchWorkerConfig<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>
	): ZBBatchWorker<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	> {
		if (this.closing) {
			throw new Error('Client is closing. No worker creation allowed!')
		}
		const config = decodeCreateZBWorkerSig({
			idOrTaskTypeOrConfig: conf,
		})
		// Merge parent client options with worker override
		const options = {
			...this.options,
			loglevel: this.loglevel,
			onConnectionError: undefined, // Do not inherit client handler
			onReady: undefined, // Do not inherit client handler
			...config.options,
		}

		const idColor = idColors[this.workerCount++ % idColors.length]

		// Give worker its own gRPC connection
		const { grpcClient: workerGRPCClient, log } = this.constructGrpcClient({
			grpcConfig: {
				namespace: 'ZBWorker',
				tasktype: config.taskType,
			},
			logConfig: {
				_tag: 'ZBWORKER',
				colorise: true,
				id: config.id ?? uuid(),
				loglevel: options.loglevel,
				namespace: ['ZBWorker', options.logNamespace].join(' ').trim(),
				pollInterval:
					options.longPoll || ZBClient.DEFAULT_LONGPOLL_PERIOD,
				stdout: options.stdout,
				taskType: `${config.taskType} (batch)`,
			},
		})
		const worker = new ZBBatchWorker<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>({
			grpcClient: workerGRPCClient,
			id: config.id || null,
			idColor,
			log,
			options: { ...this.options, ...options },
			taskHandler: config.taskHandler as ZB.ZBBatchWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
			>,
			taskType: config.taskType,
			zbClient: this,
		})
		this.workers.push(worker)
		return worker
	}

	public createWorker<
		WorkerInputVariables = ZB.InputVariables,
		CustomHeaderShape = ZB.CustomHeaders,
		WorkerOutputVariables = ZB.OutputVariables
	>(
		config: ZB.ZBWorkerConfig<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>
	): ZBWorker<WorkerInputVariables, CustomHeaderShape, WorkerOutputVariables>
	public createWorker<
		WorkerInputVariables = ZB.InputVariables,
		CustomHeaderShape = ZB.CustomHeaders,
		WorkerOutputVariables = ZB.OutputVariables
	>(
		id: string | null,
		taskType: string,
		taskHandler: ZB.ZBWorkerTaskHandler<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>,
		options?: ZB.ZBWorkerOptions<WorkerInputVariables> & ZBClientOptions,
		onConnectionError?: ZB.ConnectionErrorHandler | undefined
	): ZBWorker<WorkerInputVariables, CustomHeaderShape, WorkerOutputVariables>
	public createWorker<
		WorkerInputVariables = ZB.InputVariables,
		CustomHeaderShape = ZB.CustomHeaders,
		WorkerOutputVariables = ZB.OutputVariables
	>(
		taskType: string,
		taskHandler: ZB.ZBWorkerTaskHandler<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>,
		options?: ZB.ZBWorkerOptions<WorkerInputVariables> & ZBClientOptions,
		onConnectionError?: ZB.ConnectionErrorHandler | undefined
	): ZBWorker<WorkerInputVariables, CustomHeaderShape, WorkerOutputVariables>
	public createWorker<
		WorkerInputVariables = ZB.InputVariables,
		CustomHeaderShape = ZB.CustomHeaders,
		WorkerOutputVariables = ZB.OutputVariables
	>(
		idOrTaskTypeOrConfig:
			| string
			| null
			| ZB.ZBWorkerConfig<
					WorkerInputVariables,
					CustomHeaderShape,
					WorkerOutputVariables
			  >,
		taskTypeOrTaskHandler?:
			| string
			| ZB.ZBWorkerTaskHandler<
					WorkerInputVariables,
					CustomHeaderShape,
					WorkerOutputVariables
			  >,
		taskHandlerOrOptions?:
			| ZB.ZBWorkerTaskHandler<
					WorkerInputVariables,
					CustomHeaderShape,
					WorkerOutputVariables
			  >
			| (ZB.ZBWorkerOptions<WorkerInputVariables> & ZBClientOptions),
		optionsOrOnConnectionError?:
			| (ZB.ZBWorkerOptions<WorkerInputVariables> & ZBClientOptions)
			| ZB.ConnectionErrorHandler,
		onConnectionError?: ZB.ConnectionErrorHandler | null
	): ZBWorker<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	> {
		if (this.closing) {
			throw new Error('Client is closing. No worker creation allowed!')
		}
		const idColor = idColors[this.workerCount++ % idColors.length]
		const config = decodeCreateZBWorkerSig({
			idOrTaskTypeOrConfig,
			onConnectionError,
			optionsOrOnConnectionError,
			taskHandlerOrOptions,
			taskTypeOrTaskHandler,
		})

		// Merge parent client options with worker override
		const options = {
			...this.options,
			loglevel: this.loglevel,
			onConnectionError: undefined, // Do not inherit client handler
			onReady: undefined, // Do not inherit client handler
			...config.options,
		}

		// Give worker its own gRPC connection
		const { grpcClient: workerGRPCClient, log } = this.constructGrpcClient({
			grpcConfig: {
				namespace: 'ZBWorker',
				tasktype: config.taskType,
			},
			logConfig: {
				_tag: 'ZBWORKER',
				colorise: true,
				id: config.id!,
				loglevel: options.loglevel,
				namespace: ['ZBWorker', options.logNamespace].join(' ').trim(),
				pollInterval:
					options.longPoll || ZBClient.DEFAULT_LONGPOLL_PERIOD,
				stdout: options.stdout,
				taskType: config.taskType,
			},
		})
		const worker = new ZBWorker<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>({
			grpcClient: workerGRPCClient,
			id: config.id || null,
			idColor,
			log,
			options: { ...this.options, ...options },
			taskHandler: config.taskHandler as ZB.ZBWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
			>,
			taskType: config.taskType,
			zbClient: this,
		})
		this.workers.push(worker)
		return worker
	}

	/**
	 * Gracefully shut down all workers, draining existing tasks, and return when it is safe to exit.
	 * @returns Promise
	 * @memberof ZBClient
	 */
	public async close(timeout?: number) {
		this.closePromise =
			this.closePromise ||
			new Promise(async resolve => {
				// Prevent the creation of more workers
				this.closing = true
				await Promise.all(this.workers.map(w => w.close(timeout)))
				await this.grpc.close(timeout) // close the client GRPC channel
				this.emit('close')
				this.grpc.removeAllListeners()
				this.removeAllListeners()
				// console.log((process as any)._getActiveHandles())
				resolve()
			})
		return this.closePromise
	}

	public completeJob(
		completeJobRequest: Grpc.CompleteJobRequest
	): Promise<void> {
		const withStringifiedVariables = stringifyVariables(completeJobRequest)
		this.logger.logDebug(withStringifiedVariables)
		return this.executeOperation('completeJob', () =>
			this.grpc.completeJobSync(withStringifiedVariables)
		)
	}

	// tslint:disable: no-object-literal-type-assertion
	public createWorkflowInstance<Variables = ZB.WorkflowVariables>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc.CreateWorkflowInstanceResponse>
	public createWorkflowInstance<Variables = ZB.WorkflowVariables>(config: {
		bpmnProcessId: string
		variables: Variables
		version: number
	}): Promise<Grpc.CreateWorkflowInstanceResponse>
	public createWorkflowInstance<Variables = ZB.WorkflowVariables>(
		configOrbpmnProcessId: string | CreateWorkflowInstance<Variables>,
		variables?: Variables
	): Promise<Grpc.CreateWorkflowInstanceResponse> {
		const isConfigObject = (
			conf: CreateWorkflowInstance<Variables> | string
		): conf is CreateWorkflowInstance<Variables> => typeof conf === 'object'

		const request = isConfigObject(configOrbpmnProcessId)
			? {
					bpmnProcessId: configOrbpmnProcessId.bpmnProcessId,
					variables: configOrbpmnProcessId.variables,
					version: configOrbpmnProcessId.version || -1,
			  }
			: {
					bpmnProcessId: configOrbpmnProcessId,
					variables,
					version: -1,
			  }

		const createWorkflowInstanceRequest: Grpc.CreateWorkflowInstanceRequest = {
			bpmnProcessId: request.bpmnProcessId,
			variables: (request.variables as unknown) as object,
			version: request.version,
		}

		return this.executeOperation('createWorkflowInstance', () =>
			this.grpc.createWorkflowInstanceSync(
				stringifyVariables(createWorkflowInstanceRequest)
			)
		)
	}

	public createWorkflowInstanceWithResult<
		Variables = ZB.WorkflowVariables,
		Result = ZB.OutputVariables
	>(
		config: CreateWorkflowInstanceWithResult<Variables>
	): Promise<Grpc.CreateWorkflowInstanceWithResultResponse<Result>>
	public createWorkflowInstanceWithResult<
		Variables = ZB.WorkflowVariables,
		Result = ZB.OutputVariables
	>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc.CreateWorkflowInstanceWithResultResponse<Result>>
	public createWorkflowInstanceWithResult<
		Variables = ZB.WorkflowVariables,
		Result = ZB.OutputVariables
	>(
		configOrBpmnProcessId:
			| CreateWorkflowInstanceWithResult<Variables>
			| string,
		variables?: Variables
	) {
		const isConfigObject = (
			config: CreateWorkflowInstanceWithResult<Variables> | string
		): config is CreateWorkflowInstanceWithResult<Variables> =>
			typeof config === 'object'

		const request = isConfigObject(configOrBpmnProcessId)
			? {
					bpmnProcessId: configOrBpmnProcessId.bpmnProcessId,
					fetchVariables: configOrBpmnProcessId.fetchVariables,
					requestTimeout: configOrBpmnProcessId.requestTimeout || 0,
					variables: configOrBpmnProcessId.variables,
					version: configOrBpmnProcessId.version || -1,
			  }
			: {
					bpmnProcessId: configOrBpmnProcessId,
					fetchVariables: undefined,
					requestTimeout: 0,
					variables,
					version: -1,
			  }

		const createWorkflowInstanceRequest: Grpc.CreateWorkflowInstanceRequest = stringifyVariables(
			{
				bpmnProcessId: request.bpmnProcessId,
				variables: (request.variables as unknown) as object,
				version: request.version,
			}
		)

		return this.executeOperation('createWorkflowInstanceWithResult', () =>
			this.grpc.createWorkflowInstanceWithResultSync<Result>({
				fetchVariables: request.fetchVariables,
				request: createWorkflowInstanceRequest,
				requestTimeout: request.requestTimeout,
			})
		).then(res => parseVariables(res as any))
	}

	/**
	 *
	 * @param workflow - A path or array of paths to .bpmn files or an object describing the workflow
	 */
	public async deployWorkflow(
		workflow: ZB.DeployWorkflowFiles | ZB.DeployWorkflowBuffer
	): Promise<Grpc.DeployWorkflowResponse> {
		const deploy = (workflows: Grpc.WorkflowRequestObject[]) =>
			this.executeOperation('deployWorkflow', () =>
				this.grpc.deployWorkflowSync({
					workflows,
				})
			)

		const error = (e: NEA.NonEmptyArray<string>) =>
			Promise.reject(
				`Deployment failed. The following files were not found: ${e.join(
					', '
				)}.`
			)
		return pipe(
			bufferOrFiles(workflow),
			E.fold(deploy, files =>
				pipe(
					mapThese(files, readDefinitionFromFile),
					E.fold(error, deploy)
				)
			)
		)
	}

	public failJob(failJobRequest: Grpc.FailJobRequest): Promise<void> {
		return this.executeOperation('failJob', () =>
			this.grpc.failJobSync(failJobRequest)
		)
	}

	/**
	 * Return an array of task-types specified in a BPMN file.
	 * @param file - Path to bpmn file.
	 */
	public getServiceTypesFromBpmn(files: string | string[]) {
		const fileArray = typeof files === 'string' ? [files] : files
		return BpmnParser.getTaskTypes(BpmnParser.parseBpmn(fileArray))
	}

	/**
	 * Publish a message to the broker for correlation with a workflow instance.
	 * @param publishMessageRequest - The message to publish.
	 */
	public publishMessage<T = ZB.WorkflowVariables>(
		publishMessageRequest: Grpc.PublishMessageRequest<T>
	): Promise<void> {
		return this.executeOperation('publishMessage', () =>
			this.grpc.publishMessageSync(
				stringifyVariables(publishMessageRequest)
			)
		)
	}

	/**
	 * Publish a message to the broker for correlation with a workflow message start event.
	 * @param publishStartMessageRequest - The message to publish.
	 */
	public publishStartMessage<T = ZB.WorkflowVariables>(
		publishStartMessageRequest: Grpc.PublishStartMessageRequest<T>
	): Promise<void> {
		/**
		 * The hash of the correlationKey is used to determine the partition where this workflow will start.
		 * So we assign a random uuid to balance workflow instances created via start message across partitions.
		 *
		 * We make the correlationKey optional, because the caller can specify a correlationKey + messageId
		 * to guarantee an idempotent message.
		 *
		 * Multiple messages with the same correlationKey + messageId combination will only start a workflow once.
		 * See: https://github.com/zeebe-io/zeebe/issues/1012 and https://github.com/zeebe-io/zeebe/issues/1022
		 */

		const publishMessageRequest: Grpc.PublishMessageRequest = {
			correlationKey: uuid(),
			...publishStartMessageRequest,
		}
		return this.executeOperation('publishStartMessage', () =>
			this.grpc.publishMessageSync(
				stringifyVariables(publishMessageRequest)
			)
		)
	}

	public resolveIncident(incidentKey: string): Promise<void> {
		return this.executeOperation('resolveIncident', () =>
			this.grpc.resolveIncidentSync(incidentKey)
		)
	}

	public setVariables<Variables = ZB.WorkflowVariables>(
		request: Grpc.SetVariablesRequest<Variables>
	): Promise<void> {
		/*
		We allow developers to interact with variables as a native JS object, but the Zeebe server needs it as a JSON document
		So we stringify it here.
		*/
		if (typeof request.variables === 'object') {
			request.variables = JSON.stringify(request.variables) as any
		}
		return this.executeOperation('setVariables', () =>
			this.grpc.setVariablesSync(request)
		)
	}

	/**
	 *
	 * Report a business error (i.e. non-technical) that occurs while processing a job.
	 * The error is handled in the workflow by an error catch event.
	 * If there is no error catch event with the specified errorCode then an incident will be raised instead.
	 */
	public throwError(throwErrorRequest: Grpc.ThrowErrorRequest) {
		return this.executeOperation('throwError', () =>
			this.grpc.throwErrorSync(throwErrorRequest)
		)
	}

	/**
	 * Return the broker cluster topology
	 */
	public topology(): Promise<Grpc.TopologyResponse> {
		return this.executeOperation('topology', this.grpc.topologySync)
	}

	public updateJobRetries(
		updateJobRetriesRequest: Grpc.UpdateJobRetriesRequest
	): Promise<void> {
		return this.executeOperation('updateJobRetries', () =>
			this.grpc.updateJobRetriesSync(updateJobRetriesRequest)
		)
	}

	private constructGrpcClient({
		grpcConfig,
		logConfig,
	}: {
		grpcConfig: {
			onReady?: () => void
			onConnectionError?: () => void
			tasktype?: string
			namespace: string
		}
		logConfig: ZB.ZBLoggerConfig
	}) {
		const { grpcClient, log } = ConnectionFactory.getGrpcClient({
			grpcConfig: {
				basicAuth: this.basicAuth,
				connectionTolerance: Duration.milliseconds.from(
					this.connectionTolerance
				),
				host: this.gatewayAddress,
				loglevel: this.loglevel,
				namespace: grpcConfig.namespace,
				oAuth: this.oAuth,
				options: {
					longPoll: this.options.longPoll
						? Duration.milliseconds.from(this.options.longPoll)
						: undefined,
				},
				packageName: 'gateway_protocol',
				protoPath: path.join(__dirname, '../../proto/zeebe.proto'),
				service: 'Gateway',
				stdout: this.stdout,
				tasktype: grpcConfig.tasktype,
				useTLS: this.useTLS,
			},
			logConfig,
		})
		if (grpcConfig.onConnectionError) {
			grpcClient.on(
				ConnectionStatusEvent.ConnectionError,
				grpcConfig.onConnectionError
			)
		}
		if (grpcConfig.onReady) {
			grpcClient.on(ConnectionStatusEvent.Ready, grpcConfig.onReady)
		}
		return { grpcClient: grpcClient as ZB.ZBGrpc, log }
	}

	/**
	 * If this.retry is set true, the operation will be wrapped in an configurable retry on exceptions
	 * of gRPC error code 14 - Transient Network Failure.
	 * See: https://github.com/grpc/grpc/blob/master/doc/statuscodes.md
	 * If this.retry is false, it will be executed with no retry, and the application should handle the exception.
	 * @param operation A gRPC command operation
	 */
	private async executeOperation<T>(
		operationName: string,
		operation: () => Promise<T>,
		retries?: number
	): Promise<T> {
		return this.retry
			? this.retryOnFailure(operationName, operation, retries)
			: operation()
	}

	private _onConnectionError() {
		if (!this.connected) {
			return
		}
		this.connected = false
		// const debounce =
		// 	this.lastConnectionError &&
		// 	new Date().valueOf() - this.lastConnectionError.valueOf() >
		// 		this.connectionTolerance / 2
		// if (!debounce) {
		this.onConnectionError?.()
		this.emit(ConnectionStatusEvent.ConnectionError)
		// }
		// this.lastConnectionError = new Date()
	}

	/**
	 * This function takes a gRPC operation that returns a Promise as a function, and invokes it.
	 * If the operation throws gRPC error 14, this function will continue to try it until it succeeds
	 * or retries are exhausted.
	 * @param operation A gRPC command operation that may fail if the broker is not available
	 */
	private async retryOnFailure<T>(
		operationName: string,
		operation: () => Promise<T>,
		retries = this.maxRetries
	): Promise<T> {
		let connectionErrorCount = 0
		return promiseRetry(
			(retry, n) => {
				if (this.closing || this.grpc.channelClosed) {
					return Promise.resolve() as any
				}
				if (n > 1) {
					this.logger.logError(
						`[${operationName}]: Attempt ${n} (max: ${this.maxRetries}).`
					)
				}
				return operation().catch(err => {
					// This could be DNS resolution, or the gRPC gateway is not reachable yet, or Backpressure
					const isNetworkError =
						err.message.indexOf('14') === 0 ||
						err.message.indexOf('Stream removed') !== -1
					const isBackpressure =
						err.message.indexOf('8') === 0 || err.code === 8
					if (isNetworkError) {
						if (connectionErrorCount < 0) {
							this._onConnectionError()
						}
						connectionErrorCount++
					}
					if (isNetworkError || isBackpressure) {
						this.logger.logError(
							`[${operationName}]: ${err.message}`
						)
						retry(err)
					}
					// The gRPC channel will be closed if close has been called
					if (this.grpc.channelClosed) {
						return Promise.resolve() as any
					}
					throw err
				})
			},
			{
				maxTimeout: Duration.milliseconds.from(this.maxRetryTimeout),
				retries,
			}
		)
	}
}
