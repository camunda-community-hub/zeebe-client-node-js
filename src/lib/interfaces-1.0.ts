import { Chalk } from 'chalk'
import { MaybeTimeDuration } from 'typed-duration'
import { ZBBatchWorker } from '../zb/ZBBatchWorker'
import { ZBWorker } from '../zb/ZBWorker'
import { GrpcClient } from './GrpcClient'
import {
	CreateProcessInstanceRequest,
	CreateProcessInstanceResponse,
	CreateProcessInstanceWithResultRequest,
	CreateProcessInstanceWithResultResponse,
	DeployProcessResponse,
	FailJobRequest,
	ProcessRequestObject,
	PublishMessageRequest,
	PublishMessageResponse,
	SetVariablesRequest,
	ThrowErrorRequest,
	TopologyResponse,
	UpdateJobRetriesRequest,
	ResolveIncidentRequest,
	DeployResourceRequest,
	DeployResourceResponse,
	EvaluateDecisionRequest,
	EvaluateDecisionResponse,
	ModifyProcessInstanceRequest,
	ModifyProcessInstanceResponse,
	ProcessInstanceCreationStartInstruction,
	BroadcastSignalResponse,
	BroadcastSignalRequest,
} from './interfaces-grpc-1.0'
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

export type DeployProcessFiles = string | string[]

export interface DeployProcessBuffer {
	definition: Buffer
	name: string
}

export interface CreateProcessBaseRequest<V extends JSONDoc> {
		/** the BPMN process ID of the process definition */
		bpmnProcessId: string
		/** the version of the process; if not specified it will use the latest version */
		version?: number
		/** JSON document that will instantiate the variables for the root variable scope of the
		   * process instance.
		 */
		variables: V,
		/** The tenantId for a multi-tenant enabled cluster. */
		tenantId?: string
}

export interface CreateProcessInstanceReq<V extends JSONDoc> extends CreateProcessBaseRequest<V> {
	/**
	 * List of start instructions. If empty (default) the process instance
	 * will start at the start event. If non-empty the process instance will apply start
	 * instructions after it has been created
	 */
	startInstructions?: ProcessInstanceCreationStartInstruction[]
}

export interface CreateProcessInstanceWithResultReq<T extends JSONDoc> extends CreateProcessBaseRequest<T> {
	/** timeout in milliseconds. the request will be closed if the process is not completed before the requestTimeout.
	 * if requestTimeout = 0, uses the generic requestTimeout configured in the gateway.
	 */
	requestTimeout?: number
	/** list of names of variables to be included in `CreateProcessInstanceWithResultResponse.variables`.
	 * If empty, all visible variables in the root scope will be returned.
	 */
	fetchVariables?: string[]
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

export interface IInputVariables {
	[key: string]: any
}

export interface IProcessVariables {
	[key: string]: any
}

export interface IOutputVariables {
	[key: string]: any
}
export interface ICustomHeaders {
	[key: string]: any
}

export interface JobFailureConfiguration {
	errorMessage: string
	/**
	 * If not specified, the library will decrement the "current remaining retries" count by one
	 */
	retries?: number
	/**
	 * Optional backoff for subsequent retries, in milliseconds. If not specified, it is zero.
	 */
	retryBackOff?: number
}

declare function FailureHandler(
	errorMessage: string,
	retries?: number
): Promise<JOB_ACTION_ACKNOWLEDGEMENT>

declare function FailureHandler(
	failureConfiguration: JobFailureConfiguration
): Promise<JOB_ACTION_ACKNOWLEDGEMENT>

export interface ErrorJobWithVariables {
	variables: JSONDoc,
	errorCode: string,
	errorMessage?: string
}

export type ErrorJobOutcome = (
	errorCode: string | ErrorJobWithVariables,
	errorMessage?: string
) => Promise<JOB_ACTION_ACKNOWLEDGEMENT>

export interface JobCompletionInterface<WorkerOutputVariables> {
	/**
	 * Cancel the workflow.
	 */
	cancelWorkflow: () => Promise<JOB_ACTION_ACKNOWLEDGEMENT>
	/**
	 * Complete the job with a success, optionally passing in a state update to merge
	 * with the process variables on the broker.
	 */
	complete: (
		updatedVariables?: WorkerOutputVariables
	) => Promise<JOB_ACTION_ACKNOWLEDGEMENT>
	/**
	 * Fail the job with an informative message as to the cause. Optionally, pass in a
	 * value remaining retries. If no value is passed for retries then the current retry
	 * count is decremented. Pass in `0`for retries to raise an incident in Operate. Optionally,
	 * specify a retry backoff period in milliseconds. Default is 0ms (immediate retry) if not
	 * specified.
	 */
	fail: typeof FailureHandler
	/**
	 * Mark this job as forwarded to another system for completion. No action is taken by the broker.
	 * This method releases worker capacity to handle another job.
	 */
	forward: () => JOB_ACTION_ACKNOWLEDGEMENT
	/**
	 *
	 * Report a business error (i.e. non-technical) that occurs while processing a job.
	 * The error is handled in the process by an error catch event.
	 * If there is no error catch event with the specified errorCode then an incident will be raised instead.
	 */
	error: ErrorJobOutcome
}


export interface ZeebeJob<
	WorkerInputVariables = IInputVariables,
	CustomHeaderShape = ICustomHeaders,
	WorkerOutputVariables = IOutputVariables
>
	extends Job<WorkerInputVariables, CustomHeaderShape>,
		JobCompletionInterface<WorkerOutputVariables> {}

export type ZBWorkerTaskHandler<
	WorkerInputVariables = IInputVariables,
	CustomHeaderShape = ICustomHeaders,
	WorkerOutputVariables = IOutputVariables
> = (
	job: Readonly<
		ZeebeJob<WorkerInputVariables, CustomHeaderShape, WorkerOutputVariables>
	>,
	worker: ZBWorker<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
) => MustReturnJobActionAcknowledgement

export interface ZBLoggerOptions {
	loglevel?: Loglevel
	stdout?: any
	color?: Chalk
	longPoll?: MaybeTimeDuration
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

export interface Job<
	Variables = IInputVariables,
	CustomHeaderShape = ICustomHeaders
> {
	/** The key, a unique identifier for the job */
	readonly key: string
	/**
	 * The job type, as defined in the BPMN process (e.g. <zeebe:taskDefinition
	 * type="payment-service" />)
	 */
	readonly type: string
	/** The job's process instance key */
	readonly processInstanceKey: string
	/** The bpmn process ID of the job process definition */
	readonly bpmnProcessId: string
	/** The version of the job process definition */
	readonly processDefinitionVersion: number
	/** The key of the job process definition */
	readonly processKey: string
	/** The associated task element ID */
	readonly elementId: string
	/**
	 * The unique key identifying the associated task, unique within the scope of the
	 * process instance
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

export interface ZBWorkerOptions<InputVars = IInputVariables> {
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
	pollInterval?: MaybeTimeDuration
	/**
	 * Constrain payload to these keys only.
	 */
	fetchVariable?: (keyof InputVars)[]
	/**
	 * This handler is called when the worker cannot connect to the broker, or loses its connection.
	 */
	onConnectionErrorHandler?: ConnectionErrorHandler
	/**
	 * If a handler throws an unhandled exception, if this is set true, the process will be failed. Defaults to false.
	 */
	failProcessOnException?: boolean
	/**
	 * Enable debug tracking
	 */
	debug?: boolean
}

export type BatchedJob<
	Variables = IInputVariables,
	Headers = ICustomHeaders,
	Output = IOutputVariables
> = Job<Variables, Headers> & JobCompletionInterface<Output>

export const JOB_ACTION_ACKNOWLEDGEMENT = 'JOB_ACTION_ACKNOWLEDGEMENT' as const
type JOB_ACTION_ACKNOWLEDGEMENT = typeof JOB_ACTION_ACKNOWLEDGEMENT
export type MustReturnJobActionAcknowledgement =
	| JOB_ACTION_ACKNOWLEDGEMENT
	| Promise<JOB_ACTION_ACKNOWLEDGEMENT>

export type ZBBatchWorkerTaskHandler<V, H, O> = (
	jobs: BatchedJob<V, H, O>[],
	worker: ZBBatchWorker<V, H, O>
) =>
	| MustReturnJobActionAcknowledgement[]
	| Promise<MustReturnJobActionAcknowledgement[]>
	| Promise<MustReturnJobActionAcknowledgement>[]

export interface ZBBatchWorkerConfig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
> extends ZBWorkerBaseConfig<WorkerInputVariables> {
	/**
	 * A job handler - this must return an array of job actions (eg: job.complete(..), job.error(..)) in all code paths.
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
	connectionTolerance?: MaybeTimeDuration
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
	 * A job handler - this must return a job action - e.g.: job.complete(), job.error() - in all code paths.
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

export interface BroadcastSignalReq {
	// The name of the signal
	signalName: string;

	// the signal variables as a JSON document; to be valid, the root of the document must be an
  	// object, e.g. { "a": "foo" }. [ "foo" ] would not be valid.
	variables?: JSONDoc;
}

export interface BroadcastSignalRes {
	// the unique ID of the signal that was broadcasted.
	key: string
}

export interface ZBGrpc extends GrpcClient {
	completeJobSync: any
	activateJobsStream: any
	publishMessageSync(
		publishMessageRequest: PublishMessageRequest
	): Promise<PublishMessageResponse>
	throwErrorSync(throwErrorRequest: ThrowErrorRequest): Promise<void>
	topologySync(): Promise<TopologyResponse>
	updateJobRetriesSync(
		updateJobRetriesRequest: UpdateJobRetriesRequest
	): Promise<void>
	deployProcessSync(processes: {
		processes: ProcessRequestObject[]
	}): Promise<DeployProcessResponse>
	deployResourceSync<T>(
		resource: DeployResourceRequest
	): Promise<DeployResourceResponse<T>>
	evaluateDecisionSync(
		evaluateDecisionRequest: EvaluateDecisionRequest
	): Promise<EvaluateDecisionResponse>
	failJobSync(failJobRequest: FailJobRequest): Promise<void>
	createProcessInstanceSync(
		createProcessInstanceRequest: CreateProcessInstanceRequest
	): Promise<CreateProcessInstanceResponse>
	createProcessInstanceWithResultSync<Result>(
		createProcessInstanceWithResultRequest: CreateProcessInstanceWithResultRequest
	): Promise<CreateProcessInstanceWithResultResponse<Result>>
	cancelProcessInstanceSync(processInstanceKey: {
		processInstanceKey: string | number
	}): Promise<void>
	modifyProcessInstanceSync(request: ModifyProcessInstanceRequest): Promise<ModifyProcessInstanceResponse>
	setVariablesSync(request: SetVariablesRequest): Promise<void>
	resolveIncidentSync(
		resolveIncidentRequest: ResolveIncidentRequest
	): Promise<void>
	broadcastSignalSync(signal: BroadcastSignalRequest): Promise<BroadcastSignalResponse>
}
