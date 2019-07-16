import { Chalk } from 'chalk'
import { ZBWorker } from '../zb/ZBWorker'

export interface KeyedObject {
	[key: string]: any
}
export type Loglevel = 'INFO' | 'DEBUG' | 'NONE' | 'ERROR'

export interface CompleteFn<WorkerOutputVariables> {
	(updatedVariables?: Partial<WorkerOutputVariables>): boolean
	success: (updatedVariables?: Partial<WorkerOutputVariables>) => boolean
	failure: (errorMessage: string, retries?: number) => void
}

export type ZBWorkerTaskHandler<
	WorkerInputVariables = KeyedObject,
	CustomHeaderShape = KeyedObject,
	WorkerOutputVariables = WorkerInputVariables
> = (
	job: Job<WorkerInputVariables, CustomHeaderShape>,
	complete: CompleteFn<WorkerOutputVariables>,
	worker: ZBWorker<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	>
) => void

export interface ZBWorkerLoggerOptions {
	loglevel: Loglevel
	stdout?: any
	color?: Chalk
	namespace?: string | string[]
}

export type ConnectionErrorHandler = (error: any) => void

export interface ActivateJobsResponse {
	jobs: ActivatedJob[]
}

/**
 * Request object to send the broker to request jobs for the worker.
 */
export interface ActivateJobsRequest {
	type: string
	worker: string
	timeout: number
	maxJobsToActivate: number
	fetchVariable?: string[]
}

export interface ActivatedJob {
	readonly key: string
	type: string
	jobHeaders: JobHeaders
	/**
	 * JSON object as a string
	 */
	customHeaders: string
	worker: string
	retries: number
	/**
	 * epoch milliseconds
	 */
	deadline: string
	/**
	 * JSON object as a string
	 */
	variables: string
}

export interface Job<Variables = KeyedObject, CustomHeaders = KeyedObject> {
	readonly key: string
	type: string
	jobHeaders: JobHeaders
	customHeaders: CustomHeaders
	worker: string
	retries: number
	// epoch milliseconds
	deadline: string
	variables: Variables
}

export interface JobHeaders {
	readonly workflowInstanceKey: string
	bpmnProcessId: string
	workflowDefinitionVersion: number
	readonly workflowKey: string
	elementId: string
	readonly elementInstanceKey: string
}

export interface ZBWorkerOptions {
	/**
	 * Max concurrent tasks for this worker. Default 32.
	 */
	maxJobsToActivate?: number
	/**
	 * Max ms to allow before time out of a task given to this worker. Default: 1000ms.
	 */
	timeout?: number
	/**
	 * Poll Interval in ms. Default 100.
	 */
	pollInterval?: number
	/**
	 * Constrain payload to these keys only.
	 */
	fetchVariable?: string[]
	/**
	 * This handler is called when the worker cannot connect to the broker, or loses its connection.
	 */
	onConnectionErrorHandler?: ConnectionErrorHandler
	/**
	 * If a handler throws an unhandled exception, if this is set true, the workflow will be failed. Defaults to false.
	 */
	failWorkflowOnException?: boolean
}

export interface CreateWorkflowInstanceRequest<Variables = KeyedObject> {
	bpmnProcessId: string
	version?: number
	variables: Variables
}

export interface CreateWorkflowInstanceResponse {
	readonly workflowKey: string
	bpmnProcessId: string
	version: number
	readonly workflowInstanceKey: string
}

export enum PartitionBrokerRole {
	LEADER = 0,
	BROKER = 1,
}

export interface Partition {
	partitionId: number
	role: PartitionBrokerRole
}

export interface BrokerInfo {
	nodeId: number
	host: string
	port: number
	partitions: Partition[]
}

export interface TopologyResponse {
	brokers: BrokerInfo[]
	clusterSize: number
	partitionsCount: number
	replicationFactor: number
}

export enum ResourceType {
	// FILE type means the gateway will try to detect the resource type using the file extension of the name
	FILE = 0,
	BPMN = 1,
	YAML = 2,
}

export interface WorkflowRequestObject {
	name?: string
	type?: ResourceType
	definition: Buffer // bytes, actually
}

export interface WorkflowMetadata {
	bpmnProcessId: string
	version: number
	readonly workflowKey: string
	resourceName: string
}

export interface DeployWorkflowResponse {
	readonly key: string
	workflows: WorkflowMetadata[]
}

export interface DeployWorkflowRequest {
	workflows: WorkflowRequestObject[]
}

export interface ListWorkflowResponse {
	workflows: WorkflowMetadata[]
}

export interface PublishMessageRequest<Variables = KeyedObject> {
	/** Should match the "Message Name" in a BPMN Message Catch  */
	name: string
	/** The value to match with the field specified as "Subscription Correlation Key" in BPMN */
	correlationKey: string
	timeToLive: number
	/** Unique ID for this message */
	messageId?: string
	variables: Variables
}

export interface PublishStartMessageRequest<Variables = KeyedObject> {
	/** Should match the "Message Name" in a BPMN Message Catch  */
	name: string
	timeToLive: number
	/** Unique ID for this message */
	messageId?: string
	correlationKey?: string
	variables: Variables
}

export interface UpdateJobRetriesRequest {
	readonly jobKey: string
	retries: number
}

export interface FailJobRequest {
	readonly jobKey: string
	retries: number
	errorMessage: string
}

export interface CompleteJobRequest<Variables = KeyedObject> {
	readonly jobKey: string
	variables: Variables
}

export interface SetVariablesRequest<Variables = KeyedObject> {
	/*
	The unique identifier of a particular element; can be the workflow instance key (as
	obtained during instance creation), or a given element, such as a service task (see
	elementInstanceKey on the JobHeaders message)
	*/
	readonly elementInstanceKey: string
	variables: Partial<Variables>
	local: boolean
}

/* either workflow key or bpmn process id and version has to be specified*/
export type GetWorkflowRequest =
	| GetWorkflowRequestWithBpmnProcessId
	| GetWorkflowRequestWithWorkflowKey

export interface GetWorkflowRequestWithWorkflowKey {
	readonly workflowKey: string
}

export interface GetWorkflowRequestWithBpmnProcessId {
	/** by default set version = -1 to indicate to use the latest version */
	version?: number
	bpmnProcessId: string
}

export interface GetWorkflowResponse {
	readonly workflowKey: string
	version: number
	bpmnProcessId: string
	resourceName: string
	bpmnXml: string
}

export interface ZBClientOptions {
	loglevel?: Loglevel
	stdout?: any
	retry?: boolean
	maxRetries?: number
	maxRetryTimeout?: number
}
