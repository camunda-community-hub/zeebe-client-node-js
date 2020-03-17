import { Chalk } from 'chalk'
import { MaybeTimeDuration } from 'typed-duration'
import { ZBBatchWorker } from '../zb/ZBBatchWorker'
import { ZBWorker } from '../zb/ZBWorker'
import { GrpcClient } from './GrpcClient'
import {
	CreateWorkflowInstanceRequest,
	CreateWorkflowInstanceResponse,
	CreateWorkflowInstanceWithResultRequest,
	CreateWorkflowInstanceWithResultResponse,
	DeployWorkflowResponse,
	FailJobRequest,
	PublishMessageRequest,
	SetVariablesRequest,
	ThrowErrorRequest,
	TopologyResponse,
	UpdateJobRetriesRequest,
	WorkflowRequestObject,
} from './interfaces-grpc'
import { Loglevel, ZBCustomLogger } from './interfaces-published-contract'

export interface BasicAuthConfig {
	password: string
	username: string
}
// The JSON-stringified version of this is sent to the ZBCustomLogger
export interface ZBLogMessage {
	timestamp: Date
	context: string
	id: string
	level: Loglevel
	message: string
	time: string
}

export interface KeyedObject {
	[key: string]: any
}

export type DeployWorkflowFiles = string | string[]

export interface DeployWorkflowBuffer {
	definition: Buffer
	name: string
}

export interface CreateWorkflowInstance<T> {
	bpmnProcessId: string
	variables: T
	version: number
}

export interface CreateWorkflowInstanceWithResult<T> {
	bpmnProcessId: string
	version?: number
	variables: T
	requestTimeout?: number
	fetchVariables?: string[]
}

export interface CompleteFn<WorkerOutputVariables> {
	/**
	 * Complete the job with a success, optionally passing in a state update to merge
	 * with the workflow variables on the broker.
	 */
	success: (
		updatedVariables?: Partial<WorkerOutputVariables>
	) => Promise<boolean>
	/**
	 * Fail the job with an informative message as to the cause. Optionally pass in a
	 * value remaining retries. If no value is passed for retries then the current retry
	 * count is decremented. Pass in `0`for retries to raise an incident in Operate.
	 */
	failure: (errorMessage: string, retries?: number) => void
	/**
	 * Mark this job as forwarded to another system for completion. No action is taken by the broker.
	 * This method releases worker capacity to handle another job.
	 */
	forwarded: () => void
	/**
	 *
	 * Report a business error (i.e. non-technical) that occurs while processing a job.
	 * The error is handled in the workflow by an error catch event.
	 * If there is no error catch event with the specified errorCode then an incident will be raised instead.
	 */
	error: (errorCode: string, errorMessage?: string) => void
}

export interface OperationOptionsWithRetry {
	maxRetries: number
	retry: true
	version?: number
}

export interface OperationOptionsNoRetry {
	retry: false
	version?: number
}

export type OperationOptions =
	| OperationOptionsWithRetry
	| OperationOptionsNoRetry

export type JSON = string | number | boolean | JSON[] | JSONDoc[] | JSONDoc

export interface JSONDoc {
	[key: string]: JSON | undefined
}

export type InputVariables = KeyedObject
export type WorkflowVariables = KeyedObject
export type OutputVariables = KeyedObject
export type CustomHeaders = KeyedObject

export type ZBWorkerTaskHandler<
	WorkerInputVariables = InputVariables,
	CustomHeaderShape = CustomHeaders,
	WorkerOutputVariables = OutputVariables
> = (
	job: Readonly<Job<WorkerInputVariables, CustomHeaderShape>>,
	complete: CompleteFn<WorkerOutputVariables>,
	worker: ZBWorker<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
) => void

export interface ZBLoggerOptions {
	loglevel?: Loglevel
	stdout?: any
	color?: Chalk
	namespace: string | string[]
	pollInterval?: MaybeTimeDuration
	taskType?: string
}

export interface ZBLoggerConfig extends ZBLoggerOptions {
	id?: string
	colorise?: boolean
	_tag: 'ZBCLIENT' | 'ZBWORKER'
}

export type ConnectionErrorHandler = (error?: any) => void

export interface Job<Variables = KeyedObject, CustomHeaderShape = KeyedObject> {
	/** The key, a unique identifier for the job */
	readonly key: string
	/**
	 * The job type, as defined in the BPMN process (e.g. <zeebe:taskDefinition
	 * type="payment-service" />)
	 */
	readonly type: string
	/** The job's workflow instance key */
	readonly workflowInstanceKey: string
	/** The bpmn process ID of the job workflow definition */
	readonly bpmnProcessId: string
	/** The version of the job workflow defini` tion */
	readonly workflowDefinitionVersion: number
	/** The key of the job workflow definition */
	readonly workflowKey: string
	/** The associated task element ID */
	readonly elementId: string
	/**
	 * The unique key identifying the associated task, unique within the scope of the
	 * workflow instance
	 */
	readonly elementInstanceKey: string
	/**
	 * A set of custom headers defined during modelling
	 */
	readonly customHeaders: Readonly<CustomHeaderShape>
	/** The name of the worker that activated this job */
	readonly worker: string
	/* The amount of retries left to this job (should always be positive) */
	readonly retries: number
	// epoch milliseconds
	readonly deadline: string
	/**
	 * All visible variables in the task scope, computed at activation time.
	 */
	readonly variables: Readonly<Variables>
}

export interface ZBWorkerOptions<InputVars = any> {
	/**
	 * Max concurrent tasks for this worker. Default 32.
	 */
	maxJobsToActivate?: number
	/**
	 * The minimum amount of jobs to fetch. The worker will request more jobs only
	 * when it has capacity for this many jobs. Defaults to 0, meaning the worker will
	 * fetch more jobs as soon as it as any capacity.
	 */
	jobBatchMinSize?: number
	/**
	 * Max seconds to allow before time out of a job given to this worker. Default: 30s.
	 * The broker checks deadline timeouts every 30 seconds, so an
	 */
	timeout?: MaybeTimeDuration
	/**
	 * Poll Interval in ms. Default 100.
	 */
	pollInterval?: number
	/**
	 * Constrain payload to these keys only.
	 */
	fetchVariable?: Array<keyof InputVars>
	/**
	 * This handler is called when the worker cannot connect to the broker, or loses its connection.
	 */
	onConnectionErrorHandler?: ConnectionErrorHandler
	/**
	 * If a handler throws an unhandled exception, if this is set true, the workflow will be failed. Defaults to false.
	 */
	failWorkflowOnException?: boolean
	/**
	 * Enable debug tracking
	 */
	debug?: boolean
}

export type BatchedJob<
	Variables = KeyedObject,
	Headers = KeyedObject,
	Output = KeyedObject
> = Job<Variables, Headers> & CompleteFn<Output>

export type ZBBatchWorkerTaskHandler<V, H, O> = (
	jobs: Array<BatchedJob<V, H, O>>,
	worker: ZBBatchWorker<V, H, O>
) => void

export interface ZBBatchWorkerConfig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends ZBWorkerBaseConfig<WorkerInputVariables> {
	/**
	 * A job handler.
	 */
	taskHandler: ZBBatchWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
	/**
	 * The minimum amount of jobs to batch before calling the job handler.
	 */
	jobBatchMinSize: number
	/**
	 * The max timeout in seconds to wait for a batch to populate. If there are less than `minJobBatchSize` jobs
	 * available when this timeout is reached, all currently batched jobs will be processed, regardless.
	 * You should set this higher than the worker timeout, to avoid batched jobs timing out before they are executed.
	 */
	jobBatchMaxTime: number
}
export interface ZBWorkerBaseConfig<T> extends ZBWorkerOptions<T> {
	/**
	 * A custom id for the worker. If none is supplied, a UUID will be generated.
	 */
	id?: string

	logNamespace?: string
	/**
	 * A custom longpoll timeout. By default long polling is every 30 seconds.
	 */
	longPoll?: MaybeTimeDuration
	/**
	 * If your Grpc connection jitters, this is the window before the connectionError
	 */
	connectionTolerance?: number
	/**
	 * A log level if you want it to differ from the ZBClient
	 */
	loglevel?: Loglevel
	/**
	 * The capacity of the worker. When it is servicing this many jobs, it will not ask for more.
	 * It will also ask for a number of jobs that is the delta between this number and its currently
	 * active jobs, when activating jobs from the broker.
	 */
	/**
	 * An implementation of the ZBCustomLogger interface for logging
	 */
	stdout?: ZBCustomLogger
	/**
	 * The task type that this worker will request jobs for.
	 */
	taskType: string
	/**
	 * This handler is called when the worker (re)establishes its connection to the broker
	 */
	onReady?: () => void
	/**
	 * This handler is called when the worker cannot connect to the broker, or loses its connection.
	 */
	onConnectionError?: () => void
}

export interface ZBWorkerConfig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends ZBWorkerBaseConfig<WorkerInputVariables> {
	/**
	 * A job handler.
	 */
	taskHandler: ZBWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
	/**
	 * The minimum amount of jobs to fetch. The worker will request more jobs only
	 * when it has capacity for this many jobs. Defaults to 0, meaning the worker will
	 * fetch more jobs as soon as it as _any_ capacity.
	 */
	jobBatchMinSize?: number
}

export interface ZBGrpc extends GrpcClient {
	completeJobSync: any
	activateJobsStream: any
	publishMessageSync(
		publishMessageRequest: PublishMessageRequest
	): Promise<void>
	throwErrorSync(throwErrorRequest: ThrowErrorRequest): Promise<void>
	topologySync(): Promise<TopologyResponse>
	updateJobRetriesSync(
		updateJobRetriesRequest: UpdateJobRetriesRequest
	): Promise<void>
	deployWorkflowSync(workflows: {
		workflows: WorkflowRequestObject[]
	}): Promise<DeployWorkflowResponse>
	failJobSync(failJobRequest: FailJobRequest): Promise<void>
	createWorkflowInstanceSync(
		createWorkflowInstanceRequest: CreateWorkflowInstanceRequest
	): Promise<CreateWorkflowInstanceResponse>
	createWorkflowInstanceWithResultSync<Result>(
		createWorkflowInstanceWithResultRequest: CreateWorkflowInstanceWithResultRequest
	): Promise<CreateWorkflowInstanceWithResultResponse<Result>>
	cancelWorkflowInstanceSync(workflowInstanceKey: {
		workflowInstanceKey: string | number
	}): Promise<void>
	setVariablesSync(request: SetVariablesRequest): Promise<void>
	resolveIncidentSync(incidentKey: string): Promise<void>
}
