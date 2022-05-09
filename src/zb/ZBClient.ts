import chalk from 'chalk'
import { either as E } from 'fp-ts'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import { pipe } from 'fp-ts/lib/pipeable'
import * as path from 'path'
import promiseRetry from 'promise-retry'
import { Duration, MaybeTimeDuration } from 'typed-duration'
import { v4 as uuid } from 'uuid'
import {
	BpmnParser,
	makeAPI1ResAPI0Compatible,
	parseVariables,
	parseVariablesAndCustomHeadersToJSON,
	stringifyVariables,
	transformAPI0ReqToAPI1,
} from '../lib'
import { ConfigurationHydrator } from '../lib/ConfigurationHydrator'
import { ConnectionFactory } from '../lib/ConnectionFactory'
import { readDefinitionFromFile } from '../lib/deployWorkflow/impure'
import { bufferOrFiles, mapThese } from '../lib/deployWorkflow/pure'
import { CustomSSL } from '../lib/GrpcClient'
import * as ZB_deprecated from '../lib/interfaces'
import * as ZB from '../lib/interfaces-1.0'

// tslint:disable-next-line: no-duplicate-imports
import {
	CreateWorkflowInstance,
	CreateWorkflowInstanceWithResult,
} from '../lib/interfaces'

import * as Grpc_deprecated from '../lib/interfaces-grpc'
import * as Grpc from '../lib/interfaces-grpc-1.0'
import {
	Loglevel,
	ZBClientOptions,
	ZBCustomLogger,
} from '../lib/interfaces-published-contract'
import { OAuthProvider, OAuthProviderConfig } from '../lib/OAuthProvider'
import { ZBSimpleLogger } from '../lib/SimpleLogger'
import { StatefulLogInterceptor } from '../lib/StatefulLogInterceptor'
import { TypedEmitter } from '../lib/TypedEmitter'
import { Utils } from '../lib/utils'
import { ZBJsonLogger } from '../lib/ZBJsonLogger'
import { decodeCreateZBWorkerSig } from '../lib/ZBWorkerSignature'
import { ZBBatchWorker } from './ZBBatchWorker'
import { ZBWorker } from './ZBWorker'
import { readFileSync } from 'fs'

const idColors = [
	chalk.yellow,
	chalk.green,
	chalk.cyan,
	chalk.magenta,
	chalk.blue,
]

export const ConnectionStatusEvent = {
	close: 'close' as 'close',
	connectionError: 'connectionError' as 'connectionError',
	ready: 'ready' as 'ready',
	unknown: 'unknown' as 'unknown',
}

export class ZBClient extends TypedEmitter<typeof ConnectionStatusEvent> {
	public static readonly DEFAULT_CONNECTION_TOLERANCE = Duration.milliseconds.of(
		3000
	)
	private static readonly DEFAULT_MAX_RETRIES = -1 // Infinite retry
	private static readonly DEFAULT_MAX_RETRY_TIMEOUT = Duration.seconds.of(5)
	private static readonly DEFAULT_LONGPOLL_PERIOD = Duration.seconds.of(30)
	private static readonly DEFAULT_POLL_INTERVAL = Duration.milliseconds.of(
		300
	)
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
	private workers: (
		| ZBWorker<any, any, any>
		| ZBBatchWorker<any, any, any>
	)[] = []
	private retry: boolean
	private maxRetries: number = process.env.ZEEBE_CLIENT_MAX_RETRIES
		? parseInt(process.env.ZEEBE_CLIENT_MAX_RETRIES, 10)
		: ZBClient.DEFAULT_MAX_RETRIES
	private maxRetryTimeout: MaybeTimeDuration = process.env
		.ZEEBE_CLIENT_MAX_RETRY_TIMEOUT
		? parseInt(process.env.ZEEBE_CLIENT_MAX_RETRY_TIMEOUT, 10)
		: ZBClient.DEFAULT_MAX_RETRY_TIMEOUT
	private oAuth?: OAuthProvider
	private basicAuth?: ZB.BasicAuthConfig
	private useTLS: boolean
	private stdout: ZBCustomLogger
	private customSSL?: CustomSSL

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

		const constructorOptionsWithDefaults = {
			longPoll: ZBClient.DEFAULT_LONGPOLL_PERIOD,
			pollInterval: ZBClient.DEFAULT_POLL_INTERVAL,
			...(options ? options : {}),
			retry: options?.retry !== false,
		}
		constructorOptionsWithDefaults.loglevel =
			(process.env.ZEEBE_NODE_LOG_LEVEL as Loglevel) ||
			constructorOptionsWithDefaults.loglevel ||
			'INFO'
		this.loglevel = constructorOptionsWithDefaults.loglevel

		const logTypeFromEnvironment = () =>
			({
				JSON: ZBJsonLogger,
				SIMPLE: ZBSimpleLogger,
			}[process.env.ZEEBE_NODE_LOG_TYPE ?? 'NONE'])

		constructorOptionsWithDefaults.stdout =
			constructorOptionsWithDefaults.stdout ??
			logTypeFromEnvironment() ??
			ZBSimpleLogger

		this.stdout = constructorOptionsWithDefaults.stdout!

		this.options = ConfigurationHydrator.configure(
			gatewayAddress,
			constructorOptionsWithDefaults
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
		this.customSSL = this.options.customSSL
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
				longPoll: this.options.longPoll
					? Duration.milliseconds.from(this.options.longPoll)
					: undefined,
				namespace: this.options.logNamespace || 'ZBClient',
				pollInterval: this.options.pollInterval
					? Duration.milliseconds.from(this.options.pollInterval)
					: undefined,
				stdout: this.stdout,
			},
		})

		grpcClient.on(ConnectionStatusEvent.connectionError, () => {
			if (this.connected !== false) {
				this.onConnectionError?.()
				this.emit(ConnectionStatusEvent.connectionError)
			}
			this.connected = false
			this.readied = false
		})
		grpcClient.on(ConnectionStatusEvent.ready, () => {
			if (!this.readied) {
				this.onReady?.()
				this.emit(ConnectionStatusEvent.ready)
			}
			this.connected = true
			this.readied = true
		})
		this.grpc = grpcClient
		this.logger = log

		this.retry = this.options.retry!
		this.maxRetries =
			this.options.maxRetries || ZBClient.DEFAULT_MAX_RETRIES

		this.maxRetryTimeout =
			this.options.maxRetryTimeout || ZBClient.DEFAULT_MAX_RETRY_TIMEOUT

		// Send command to broker to eagerly fail / prove connection.
		// This is useful for, for example: the Node-Red client, which wants to
		// display the connection status.
		if (this.options.eagerConnection ?? false) {
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
						this.emit(ConnectionStatusEvent.unknown)
					}
				})
		}
	}

	public activateJobs<
		Variables = ZB.IInputVariables,
		CustomHeaders = ZB.ICustomHeaders
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
	/**
	 * @deprecated use cancelProcessInstance instead
	 */
	public async cancelWorkflowInstance(
		workflowInstanceKey: string | number
	): Promise<void> {
		Utils.validateNumber(workflowInstanceKey, 'workflowInstanceKey')
		return this.cancelProcessInstance(workflowInstanceKey)
	}

	public async cancelProcessInstance(
		processInstanceKey: string | number
	): Promise<void> {
		Utils.validateNumber(processInstanceKey, 'processInstanceKey')
		return this.executeOperation('cancelProcessInstance', () =>
			this.grpc.cancelProcessInstanceSync({
				processInstanceKey,
			})
		)
	}

	public createBatchWorker<
		WorkerInputVariables = ZB.IInputVariables,
		CustomHeaderShape = ZB.ICustomHeaders,
		WorkerOutputVariables = ZB.IOutputVariables
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
		WorkerInputVariables = ZB.IInputVariables,
		CustomHeaderShape = ZB.ICustomHeaders,
		WorkerOutputVariables = ZB.IOutputVariables
	>(
		config: ZB.ZBWorkerConfig<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>
	): ZBWorker<WorkerInputVariables, CustomHeaderShape, WorkerOutputVariables>
	/**
	 * @deprecated use the object constructor instead
	 */
	public createWorker<
		WorkerInputVariables = ZB.IInputVariables,
		CustomHeaderShape = ZB.ICustomHeaders,
		WorkerOutputVariables = ZB.IOutputVariables
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
	/**
	 * @deprecated use the object constructor instead
	 */
	public createWorker<
		WorkerInputVariables = ZB.IInputVariables,
		CustomHeaderShape = ZB.ICustomHeaders,
		WorkerOutputVariables = ZB.IOutputVariables
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
		WorkerInputVariables = ZB.IInputVariables,
		CustomHeaderShape = ZB.ICustomHeaders,
		WorkerOutputVariables = ZB.IOutputVariables
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
	public async close(timeout?: number): Promise<null> {
		this.closePromise =
			this.closePromise ||
			new Promise(async resolve => {
				// Prevent the creation of more workers
				this.closing = true
				await Promise.all(this.workers.map(w => w.close(timeout)))
				await this.grpc.close(timeout) // close the client GRPC channel
				this.emit(ConnectionStatusEvent.close)
				this.grpc.removeAllListeners()
				this.removeAllListeners()
				resolve(null)
			})
		return this.closePromise
	}

	public completeJob(
		completeJobRequest: Grpc.CompleteJobRequest
	): Promise<void> {
		const withStringifiedVariables = stringifyVariables(completeJobRequest)
		this.logger.logDebug(withStringifiedVariables)
		return this.executeOperation('completeJob', () =>
			this.grpc.completeJobSync(withStringifiedVariables).catch(e => {
				if (e.code === 5) {
					e.details +=
						'. The process may have been cancelled, the job cancelled by an interrupting event, or the job already completed.' +
						' For more detail, see: https://forum.zeebe.io/t/command-rejected-with-code-complete/908/17'
				}
				throw e
			})
		)
	}

	// tslint:disable: no-object-literal-type-assertion
	/**
	 * @deprecated use createProcessInstance instead
	 */
	public createWorkflowInstance<Variables = ZB_deprecated.IWorkflowVariables>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc_deprecated.CreateWorkflowInstanceResponse>
	public createWorkflowInstance<
		Variables = ZB_deprecated.IWorkflowVariables
	>(config: {
		bpmnProcessId: string
		variables: Variables
		version: number
	}): Promise<Grpc_deprecated.CreateWorkflowInstanceResponse>
	public createWorkflowInstance<Variables = ZB_deprecated.IWorkflowVariables>(
		configOrbpmnProcessId: string | CreateWorkflowInstance<Variables>,
		variables?: Variables
	): Promise<Grpc_deprecated.CreateWorkflowInstanceResponse> {
		return this.createProcessInstance(
			transformAPI0ReqToAPI1(configOrbpmnProcessId),
			transformAPI0ReqToAPI1(variables)
		).then(res => makeAPI1ResAPI0Compatible(res))
	}

	public createProcessInstance<Variables = ZB.IProcessVariables>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc.CreateProcessInstanceResponse>
	public createProcessInstance<Variables = ZB.IProcessVariables>(config: {
		bpmnProcessId: string
		variables: Variables
		version: number
	}): Promise<Grpc.CreateProcessInstanceResponse>
	public createProcessInstance<Variables = ZB.IProcessVariables>(
		configOrbpmnProcessId: string | ZB.CreateProcessInstance<Variables>,
		variables?: Variables
	): Promise<Grpc.CreateProcessInstanceResponse> {
		const isConfigObject = (
			conf: ZB.CreateProcessInstance<Variables> | string
		): conf is ZB.CreateProcessInstance<Variables> =>
			typeof conf === 'object'

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

		const createProcessInstanceRequest: Grpc.CreateProcessInstanceRequest = {
			bpmnProcessId: request.bpmnProcessId,
			variables: (request.variables as unknown) as object,
			version: request.version,
		}

		return this.executeOperation('createProcessInstance', () =>
			this.grpc.createProcessInstanceSync(
				stringifyVariables(createProcessInstanceRequest)
			)
		)
	}

	/**
	 * @deprecated use createProcessInstanceWithResult instead
	 *
	 */
	public createWorkflowInstanceWithResult<
		Variables = ZB_deprecated.IWorkflowVariables,
		Result = ZB.IOutputVariables
	>(
		config: CreateWorkflowInstanceWithResult<Variables>
	): Promise<Grpc_deprecated.CreateWorkflowInstanceWithResultResponse<Result>>
	/**
	 * @deprecated use createProcessInstanceWithResult instead
	 *
	 */
	public createWorkflowInstanceWithResult<
		Variables = ZB_deprecated.IWorkflowVariables,
		Result = ZB.IOutputVariables
	>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc_deprecated.CreateWorkflowInstanceWithResultResponse<Result>>
	/**
	 * @deprecated use createProcessInstanceWithResult instead
	 *
	 */
	public createWorkflowInstanceWithResult<
		Variables = ZB_deprecated.IWorkflowVariables,
		// @ts-ignore - this is for backward compatibility
		Result = ZB_deprecated.IOutputVariables
	>(
		configOrBpmnProcessId:
			| CreateWorkflowInstanceWithResult<Variables>
			| string,
		variables?: Variables
	) {
		return this.createProcessInstanceWithResult(
			transformAPI0ReqToAPI1(configOrBpmnProcessId),
			transformAPI0ReqToAPI1(variables)
		).then(res => makeAPI1ResAPI0Compatible(res))
	}

	public createProcessInstanceWithResult<
		Variables = ZB.IInputVariables,
		Result = ZB.IOutputVariables
	>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc.CreateProcessInstanceWithResultResponse<Result>>
	public createProcessInstanceWithResult<
		Variables = ZB.IProcessVariables,
		Result = ZB.IOutputVariables
	>(
		config: ZB.CreateProcessInstanceWithResult<Variables>
	): Promise<Grpc.CreateProcessInstanceWithResultResponse<Result>>
	public createProcessInstanceWithResult<
		Variables = ZB.IProcessVariables,
		Result = ZB.IOutputVariables
	>(
		bpmnProcessId: string,
		variables: Variables
	): Promise<Grpc.CreateProcessInstanceWithResultResponse<Result>>
	public createProcessInstanceWithResult<
		Variables = ZB.IProcessVariables,
		Result = ZB.IOutputVariables
	>(
		configOrBpmnProcessId:
			| ZB.CreateProcessInstanceWithResult<Variables>
			| string,
		variables?: Variables
	) {
		const isConfigObject = (
			config: ZB.CreateProcessInstanceWithResult<Variables> | string
		): config is ZB.CreateProcessInstanceWithResult<Variables> =>
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

		const createProcessInstanceRequest: Grpc.CreateProcessInstanceRequest = stringifyVariables(
			{
				bpmnProcessId: request.bpmnProcessId,
				variables: (request.variables as unknown) as object,
				version: request.version,
			}
		)

		return this.executeOperation('createProcessInstanceWithResult', () =>
			this.grpc.createProcessInstanceWithResultSync<Result>({
				fetchVariables: request.fetchVariables,
				request: createProcessInstanceRequest,
				requestTimeout: request.requestTimeout,
			})
		).then(res => parseVariables(res as any))
	}

	/**
	 *
	 * @param workflow - A path or array of paths to .bpmn files or an object describing the workflow
	 * @deprecated use deployProcess instead
	 */
	public async deployWorkflow(
		workflow:
			| ZB_deprecated.DeployWorkflowFiles
			| ZB_deprecated.DeployWorkflowBuffer
	): Promise<Grpc_deprecated.DeployWorkflowResponse> {
		return this.deployProcess(workflow).then(res =>
			makeAPI1ResAPI0Compatible(res)
		)
	}

	public async deployResource(
		resource:
			| { processFilename: string }
			| { name: string; process: Buffer }
	): Promise<Grpc.DeployResourceResponse<Grpc.ProcessDeployment>>
	public async deployResource(
		resource:
			| { decisionFilename: string }
			| { name: string; decision: Buffer }
	): Promise<Grpc.DeployResourceResponse<Grpc.DecisionDeployment>>
	async deployResource(
		resource:
			| { processFilename: string }
			| { name: string; process: Buffer }
			| { name: string; decision: Buffer }
			| { decisionFilename: string }
	): Promise<
		Grpc.DeployResourceResponse<
			| Grpc.ProcessDeployment
			| Grpc.DecisionDeployment
			| Grpc.DecisionRequirementsDeployment
		>
	> {
		const isProcess = (
			maybeProcess: any
		): maybeProcess is { process: Buffer; name: string } =>
			!!maybeProcess.process
		const isProcessFilename = (
			maybeProcessFilename: any
		): maybeProcessFilename is { processFilename: string } =>
			!!maybeProcessFilename.processFilename
		const isDecision = (
			maybeDecision: any
		): maybeDecision is { decision: Buffer; name: string } =>
			!!maybeDecision.decision
		if (isProcessFilename(resource)) {
			const filename = resource.processFilename
			const process = readFileSync(filename)
			return this.executeOperation('deployResource', () =>
				this.grpc.deployResourceSync({
					resources: [
						{
							name: filename,
							content: process,
						},
					],
				})
			)
		} else if (isProcess(resource)) {
			return this.executeOperation('deployResource', () =>
				this.grpc.deployResourceSync({
					resources: [
						{
							name: resource.name,
							content: resource.process,
						},
					],
				})
			)
		} else if (isDecision(resource)) {
			return this.executeOperation('deployResource', () =>
				this.grpc.deployResourceSync({
					resources: [
						{
							name: resource.name,
							content: resource.decision,
						},
					],
				})
			)
		} else {
			const filename = resource.decisionFilename
			const decision = readFileSync(filename)
			return this.executeOperation('deployResource', () =>
				this.grpc.deployResourceSync({
					resources: [
						{
							name: filename,
							content: decision,
						},
					],
				})
			)
		}
	}

	public async deployProcess(
		process: ZB.DeployProcessFiles | ZB.DeployProcessBuffer
	): Promise<Grpc.DeployProcessResponse> {
		const deploy = (processes: Grpc.ProcessRequestObject[]) =>
			this.executeOperation('deployWorkflow', () =>
				this.grpc.deployProcessSync({
					processes,
				})
			)

		const error = (e: NEA.NonEmptyArray<string>) =>
			Promise.reject(
				`Deployment failed. The following files were not found: ${e.join(
					', '
				)}.`
			)
		return pipe(
			bufferOrFiles(process),
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
	public publishMessage<ProcessVariables = ZB.IProcessVariables>(
		publishMessageRequest: Grpc.PublishMessageRequest<ProcessVariables>
	): Promise<Grpc.PublishMessageResponse> {
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
	public publishStartMessage<ProcessVariables = ZB.IProcessVariables>(
		publishStartMessageRequest: Grpc.PublishStartMessageRequest<
			ProcessVariables
		>
	): Promise<Grpc.PublishMessageResponse> {
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

	public resolveIncident(
		resolveIncidentRequest: Grpc.ResolveIncidentRequest
	): Promise<void> {
		return this.executeOperation('resolveIncident', () =>
			this.grpc.resolveIncidentSync(resolveIncidentRequest)
		)
	}

	public setVariables<Variables = ZB.IProcessVariables>(
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
				customSSL: this.customSSL,
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
				ConnectionStatusEvent.connectionError,
				grpcConfig.onConnectionError
			)
		}
		if (grpcConfig.onReady) {
			grpcClient.on(ConnectionStatusEvent.ready, grpcConfig.onReady)
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
		this.emit(ConnectionStatusEvent.connectionError)
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
				forever: retries === -1,
				maxTimeout: Duration.milliseconds.from(this.maxRetryTimeout),
				retries: retries === -1 ? undefined : retries,
			}
		)
	}
}
