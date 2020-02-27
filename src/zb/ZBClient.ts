import chalk from 'chalk'
import { EventEmitter } from 'events'
import { either as E, pipeable } from 'fp-ts'
import * as A from 'fp-ts/lib/Array'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as fs from 'fs'
import * as path from 'path'
import promiseRetry from 'promise-retry'
import { v4 as uuid } from 'uuid'
import { BpmnParser, parseVariables, stringifyVariables } from '../lib'
import { ConfigurationHydrator } from '../lib/ConfigurationHydrator'
import { GRPCClient } from '../lib/GRPCClient'
import * as ZB from '../lib/interfaces'
// tslint:disable-next-line: no-duplicate-imports
import {
	CreateWorkflowInstance,
	CreateWorkflowInstanceWithResult,
} from '../lib/interfaces'
import { OAuthProvider, OAuthProviderConfig } from '../lib/OAuthProvider'
import { ZBSimpleLogger } from '../lib/SimpleLogger'
import { Utils } from '../lib/utils'
import { ZBLogger } from '../lib/ZBLogger'
import { decodeCreateZBWorkerSig } from '../lib/ZBWorkerSignature'
import { ZBWorker } from './ZBWorker'

const idColors = [
	chalk.yellow,
	chalk.green,
	chalk.cyan,
	chalk.magenta,
	chalk.blue,
]

export class ZBClient extends EventEmitter {
	public static readonly DEFAULT_CONNECTION_TOLERANCE = 3000
	private static readonly DEFAULT_MAX_RETRIES = 50
	private static readonly DEFAULT_MAX_RETRY_TIMEOUT = 5000
	private static readonly DEFAULT_LONGPOLL_PERIOD = 30000
	public connectionTolerance: number = ZBClient.DEFAULT_CONNECTION_TOLERANCE
	public connected = false
	public gatewayAddress: string
	public loglevel: ZB.Loglevel
	public onReady?: () => void
	public onConnectionError?: () => void
	private logger: ZBLogger
	private closePromise?: Promise<any>
	private closing = false
	// A gRPC channel for the ZBClient to execute commands on
	private gRPCClient: ZB.ZBGRPC
	private options: ZB.ZBClientOptions
	private workerCount = 0
	private workers: Array<ZBWorker<any, any, any>> = []
	private retry: boolean
	private maxRetries: number
	private maxRetryTimeout: number
	private oAuth?: OAuthProvider
	private basicAuth?: ZB.BasicAuthConfig
	private useTLS: boolean
	private stdout: ZB.ZBCustomLogger
	private lastReady?: Date
	private lastConnectionError?: Date

	/**
	 *
	 * @param options Zero-conf constructor. The entire ZBClient connection config can be passed in via the environment.
	 */
	constructor(options?: ZB.ZBClientOptions)
	constructor(gatewayAddress: string, options?: ZB.ZBClientOptions)
	constructor(
		gatewayAddress?: string | ZB.ZBClientOptions,
		options?: ZB.ZBClientOptions
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
			(process.env.ZB_NODE_LOG_LEVEL as ZB.Loglevel) ||
			(process.env.ZEEBE_NODE_LOG_LEVEL as ZB.Loglevel) ||
			this.options.loglevel ||
			'INFO'
		this.loglevel = this.options.loglevel
		this.options.stdout = this.options.stdout || ZBSimpleLogger
		this.stdout = this.options.stdout

		this.logger = new ZBLogger({
			loglevel: this.loglevel,
			namespace: this.options.logNamespace || 'ZBClient',
			pollInterval: this.options.longPoll!,
			stdout: this.stdout,
		})

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
		this.connectionTolerance =
			this.options.connectionTolerance || this.connectionTolerance
		this.onConnectionError = this.options.onConnectionError
		this.onReady = this.options.onReady
		this.gRPCClient = this.constructGrpcClient({
			namespace: this.options.logNamespace || 'ZBClient',
			onConnectionError: () => this._onConnectionError(),
			onReady: () => this._onReady(),
		})

		this.retry = this.options.retry !== false
		this.maxRetries =
			this.options.maxRetries || ZBClient.DEFAULT_MAX_RETRIES
		this.maxRetryTimeout =
			this.options.maxRetryTimeout || ZBClient.DEFAULT_MAX_RETRY_TIMEOUT
		// Send command to broker to eagerly fail / prove connection.
		// This is useful for, for example: the Node-Red client, which wants to
		// display the connection status.
		this.topology().catch(e => {
			// Swallow exception to avoid throwing if retries are off
			if (e.thisWillNeverHappenYo) {
				this.emit('never')
			}
		})
	}

	public async cancelWorkflowInstance(
		workflowInstanceKey: string | number
	): Promise<void> {
		Utils.validateNumber(workflowInstanceKey, 'workflowInstanceKey')
		return this.executeOperation('cancelWorkflowInstance', () =>
			this.gRPCClient.cancelWorkflowInstanceSync({
				workflowInstanceKey,
			})
		)
	}

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
		options?: ZB.ZBWorkerOptions & ZB.ZBClientOptions,
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
		options?: ZB.ZBWorkerOptions & ZB.ZBClientOptions,
		onConnectionError?: ZB.ConnectionErrorHandler | undefined
	): ZBWorker<WorkerInputVariables, CustomHeaderShape, WorkerOutputVariables>
	public createWorker<
		WorkerInputVariables = ZB.InputVariables,
		CustomHeaderShape = ZB.CustomHeaders,
		WorkerOutputVariables = ZB.OutputVariables
	>(
		idOrTaskType: string | null,
		taskTypeOrTaskHandler:
			| string
			| ZB.ZBWorkerTaskHandler<
					WorkerInputVariables,
					CustomHeaderShape,
					WorkerOutputVariables
			  >,
		taskHandlerOrOptions:
			| ZB.ZBWorkerTaskHandler<
					WorkerInputVariables,
					CustomHeaderShape,
					WorkerOutputVariables
			  >
			| (ZB.ZBWorkerOptions & ZB.ZBClientOptions)
			| undefined,
		optionsOrOnConnectionError:
			| (ZB.ZBWorkerOptions & ZB.ZBClientOptions)
			| ZB.ConnectionErrorHandler
			| undefined,
		onConnectionError?: ZB.ConnectionErrorHandler | undefined
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
			idOrTaskType,
			optionsOrOnConnectionError,
			taskHandlerOrOptions,
			taskTypeOrTaskHandler,
		})

		const onReady = config.onReady
		// tslint:disable-next-line: variable-name
		const _onConnectionError = (err?: any) => {
			worker.emit('connectionError', err)
			// Allow a per-worker handler for specialised behaviour
			if (onConnectionError) {
				config.onConnectionError(err)
			}
		}
		// tslint:disable-next-line: variable-name
		const _onReady = () => {
			worker.emit('ready')
			if (onReady) {
				onReady()
			}
		}
		// Merge parent client options with worker override
		const options = {
			...this.options,
			loglevel: this.loglevel,
			onReady: undefined, // Do not inherit client handler
			...config.options,
		}
		// Give worker its own gRPC connection
		const workerGRPCClient = this.constructGrpcClient({
			namespace: 'ZBWorker',
			onConnectionError: _onConnectionError,
			onReady: _onReady,
			tasktype: config.taskType,
		})
		const worker = new ZBWorker<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>({
			gRPCClient: workerGRPCClient,
			id: config.id,
			idColor,
			onConnectionError,
			options: { ...this.options, ...options },
			taskHandler: config.taskHandler,
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
				await this.gRPCClient.close(timeout) // close the client GRPC channel
				resolve()
			})
		return this.closePromise
	}

	public completeJob(
		completeJobRequest: ZB.CompleteJobRequest
	): Promise<void> {
		const withStringifiedVariables = stringifyVariables(completeJobRequest)
		this.logger.debug(withStringifiedVariables)
		return this.executeOperation('completeJob', () =>
			this.gRPCClient.completeJobSync(withStringifiedVariables)
		)
	}

	// tslint:disable: no-object-literal-type-assertion
	public createWorkflowInstance<Variables = ZB.WorkflowVariables>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<ZB.CreateWorkflowInstanceResponse>
	public createWorkflowInstance<Variables = ZB.WorkflowVariables>(config: {
		bpmnProcessId: string
		variables: Variables
		version: number
	}): Promise<ZB.CreateWorkflowInstanceResponse>
	public createWorkflowInstance<Variables = ZB.WorkflowVariables>(
		configOrbpmnProcessId: string | CreateWorkflowInstance<Variables>,
		variables?: Variables
	): Promise<ZB.CreateWorkflowInstanceResponse> {
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

		const createWorkflowInstanceRequest: ZB.CreateWorkflowInstanceRequest = {
			bpmnProcessId: request.bpmnProcessId,
			variables: (request.variables as unknown) as object,
			version: request.version,
		}

		return this.executeOperation('createWorkflowInstance', () =>
			this.gRPCClient.createWorkflowInstanceSync(
				stringifyVariables(createWorkflowInstanceRequest)
			)
		)
	}

	public createWorkflowInstanceWithResult<
		Variables = ZB.WorkflowVariables,
		Result = ZB.OutputVariables
	>(
		config: CreateWorkflowInstanceWithResult<Variables>
	): Promise<ZB.CreateWorkflowInstanceWithResultResponse<Result>>
	public createWorkflowInstanceWithResult<
		Variables = ZB.WorkflowVariables,
		Result = ZB.OutputVariables
	>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<ZB.CreateWorkflowInstanceWithResultResponse<Result>>
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

		const createWorkflowInstanceRequest: ZB.CreateWorkflowInstanceRequest = stringifyVariables(
			{
				bpmnProcessId: request.bpmnProcessId,
				variables: (request.variables as unknown) as object,
				version: request.version,
			}
		)

		return this.executeOperation('createWorkflowInstanceWithResult', () =>
			this.gRPCClient.createWorkflowInstanceWithResultSync<Result>({
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
	): Promise<ZB.DeployWorkflowResponse> {
		const isBuffer = (
			wf: ZB.DeployWorkflowBuffer | ZB.DeployWorkflowFiles
		): wf is ZB.DeployWorkflowBuffer =>
			!!(wf as ZB.DeployWorkflowBuffer).definition

		const bufferOrFiles = (
			wf: ZB.DeployWorkflowFiles | ZB.DeployWorkflowBuffer
		): E.Either<ZB.DeployWorkflowBuffer[], string[]> =>
			isBuffer(wf) ? E.left([wf]) : E.right(coerceFilenamesToArray(wf))

		const coerceFilenamesToArray = (wf: string | string[]): string[] =>
			Array.isArray(wf) ? wf : [wf]

		const readDefinitionFromFile = (
			file: string
		): E.Either<string, ZB.WorkflowRequestObject> =>
			fs.existsSync(file)
				? E.right({
						definition: fs.readFileSync(file),
						name: path.basename(file),
						type: 1,
				  })
				: E.left(file)

		const deploy = (workflows: ZB.WorkflowRequestObject[]) =>
			this.executeOperation('deployWorkflow', () =>
				this.gRPCClient.deployWorkflowSync({
					workflows,
				})
			)

		const error = (e: NEA.NonEmptyArray<string>) =>
			Promise.reject(
				`Deployment failed. The following files were not found: ${e.join(
					', '
				)}.`
			)

		const readBpmnFiles = <Path, Err, Wfd>(
			paths: Path[],
			read: (path: Path) => E.Either<Err, Wfd>
		): E.Either<NEA.NonEmptyArray<Err>, Wfd[]> =>
			A.array.traverse(E.getValidation(NEA.getSemigroup<Err>()))(
				paths,
				(filepath: Path) =>
					pipeable.pipe(read(filepath), E.mapLeft(NEA.of))
			)

		return pipeable.pipe(
			bufferOrFiles(workflow),
			E.fold(deploy, files =>
				pipeable.pipe(
					readBpmnFiles(files, readDefinitionFromFile),
					E.fold(error, deploy)
				)
			)
		)
	}

	public failJob(failJobRequest: ZB.FailJobRequest): Promise<void> {
		return this.executeOperation('failJob', () =>
			this.gRPCClient.failJobSync(failJobRequest)
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
		publishMessageRequest: ZB.PublishMessageRequest<T>
	): Promise<void> {
		return this.executeOperation('publishMessage', () =>
			this.gRPCClient.publishMessageSync(
				stringifyVariables(publishMessageRequest)
			)
		)
	}

	/**
	 * Publish a message to the broker for correlation with a workflow message start event.
	 * @param publishStartMessageRequest - The message to publish.
	 */
	public publishStartMessage<T = ZB.WorkflowVariables>(
		publishStartMessageRequest: ZB.PublishStartMessageRequest<T>
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

		const publishMessageRequest: ZB.PublishMessageRequest = {
			correlationKey: uuid(),
			...publishStartMessageRequest,
		}
		return this.executeOperation('publishStartMessage', () =>
			this.gRPCClient.publishMessageSync(
				stringifyVariables(publishMessageRequest)
			)
		)
	}

	public resolveIncident(incidentKey: string): Promise<void> {
		return this.executeOperation('resolveIncident', () =>
			this.gRPCClient.resolveIncidentSync(incidentKey)
		)
	}

	public setVariables<Variables = ZB.WorkflowVariables>(
		request: ZB.SetVariablesRequest<Variables>
	): Promise<void> {
		/*
		We allow developers to interact with variables as a native JS object, but the Zeebe server needs it as a JSON document
		So we stringify it here.
		*/
		if (typeof request.variables === 'object') {
			request.variables = JSON.stringify(request.variables) as any
		}
		return this.executeOperation('setVariables', () =>
			this.gRPCClient.setVariablesSync(request)
		)
	}

	/**
	 *
	 * Report a business error (i.e. non-technical) that occurs while processing a job.
	 * The error is handled in the workflow by an error catch event.
	 * If there is no error catch event with the specified errorCode then an incident will be raised instead.
	 */
	public throwError(throwErrorRequest: ZB.ThrowErrorRequest) {
		return this.executeOperation('throwError', () =>
			this.gRPCClient.throwErrorSync(throwErrorRequest)
		)
	}

	/**
	 * Return the broker cluster topology
	 */
	public topology(): Promise<ZB.TopologyResponse> {
		return this.executeOperation('topology', this.gRPCClient.topologySync)
	}

	public updateJobRetries(
		updateJobRetriesRequest: ZB.UpdateJobRetriesRequest
	): Promise<void> {
		return this.executeOperation('updateJobRetries', () =>
			this.gRPCClient.updateJobRetriesSync(updateJobRetriesRequest)
		)
	}

	private constructGrpcClient({
		onReady,
		onConnectionError,
		tasktype,
		namespace,
	}: {
		onReady?: () => void
		onConnectionError?: () => void
		tasktype?: string
		namespace: string
	}) {
		return new GRPCClient({
			basicAuth: this.basicAuth,
			connectionTolerance: this.connectionTolerance,
			host: this.gatewayAddress,
			loglevel: this.loglevel,
			namespace,
			oAuth: this.oAuth,
			onConnectionError,
			onReady,
			options: { longPoll: this.options.longPoll },
			packageName: 'gateway_protocol',
			protoPath: path.join(__dirname, '../../proto/zeebe.proto'),
			service: 'Gateway',
			stdout: this.stdout,
			tasktype,
			useTLS: this.useTLS,
		}) as ZB.ZBGRPC
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
		this.connected = false
		if (this.lastConnectionError) {
			const now = new Date()
			const delta = now.valueOf() - this.lastConnectionError.valueOf()
			if (delta > this.connectionTolerance / 2) {
				if (this.onConnectionError) {
					// @TODO is this the right window?
					this.onConnectionError()
				}
				this.emit('connectionError')
			}
		} else {
			if (this.onConnectionError) {
				this.onConnectionError()
			}
			this.emit('connectionError')
		}
		this.lastConnectionError = new Date()
	}

	private _onReady() {
		this.connected = true
		if (this.lastReady) {
			const now = new Date()
			const delta = now.valueOf() - this.lastReady.valueOf()
			if (delta > this.connectionTolerance / 2) {
				// @TODO is this the right window?
				if (this.onReady) {
					this.onReady()
				}
				this.emit('ready')
			}
		} else {
			if (this.onReady) {
				this.onReady()
			}
			this.emit('ready')
		}
		this.lastReady = new Date()
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
		return promiseRetry(
			(retry, n) => {
				if (this.closing || this.gRPCClient.channelClosed) {
					return Promise.resolve() as any
				}
				if (n > 1) {
					this.logger.error(
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
					if (isNetworkError || isBackpressure) {
						this.logger.error(`[${operationName}]: ${err.message}`)
						retry(err)
					}
					// The gRPC channel will be closed if close has been called
					if (this.gRPCClient.channelClosed) {
						return Promise.resolve() as any
					}
					throw err
				})
			},
			{
				maxTimeout: this.maxRetryTimeout,
				retries,
			}
		)
	}
}
