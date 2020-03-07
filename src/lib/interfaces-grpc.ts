import { MaybeTimeDuration } from 'typed-duration'
import { KeyedObject } from './interfaces'

/**
 * Request object to send the broker to request jobs for the worker.
 */
export interface ActivateJobsRequest {
	/**
	 * The job type, as defined in the BPMN process (e.g. <zeebe:taskDefinition
	 * type="payment-service" />)
	 */
	type: string
	/** The name of the worker activating the jobs, mostly used for logging purposes */
	worker: string
	/**
	 * The duration the broker allows for jobs activated by this call to complete
	 * before timing them out releasing them for retry on the broker.
	 * The broker checks time outs every 30 seconds, so the broker timeout is guaranteed in at-most timeout + 29s
	 * be guaranteed.
	 */
	timeout: MaybeTimeDuration
	/**
	 * The maximum jobs to activate by this request
	 */
	maxJobsToActivate: number
	/**
	 * A list of variables to fetch as the job variables; if empty, all visible variables at
	 * the time of activation for the scope of the job will be returned
	 */
	fetchVariable?: string[]
	/**
	 * The request will be completed when atleast one job is activated or after the requestTimeout.
	 * if the requestTimeout = 0, the request will be completed after a default configured timeout in the broker.
	 * To immediately complete the request when no job is activated set the requestTimeout to a negative value
	 *
	 */
	requestTimeout: MaybeTimeDuration
}

export interface ActivatedJob {
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
	/** The version of the job workflow definition */
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
	readonly customHeaders: string
	/** The name of the worker that activated this job */
	readonly worker: string
	/* The amount of retries left to this job (should always be positive) */
	readonly retries: number
	/**
	 * When the job will timeout on the broker if it is not completed by this worker.
	 * In epoch milliseconds
	 */
	readonly deadline: string
	/**
	 * All visible variables in the task scope, computed at activation time, constrained by any
	 * fetchVariables value in the ActivateJobRequest.
	 */
	readonly variables: string
}

export interface ActivateJobsResponse {
	jobs: ActivatedJob[]
}

export interface CreateWorkflowInstanceRequest<Variables = KeyedObject> {
	bpmnProcessId: string
	version?: number
	variables: Variables
}

export interface CreateWorkflowInstanceResponse {
	/**
	 * The unique key identifying the workflow definition (e.g. returned from a workflow
	 * in the DeployWorkflowResponse message)
	 */
	readonly workflowKey: string
	/**
	 * The BPMN process ID of the workflow definition
	 */
	readonly bpmnProcessId: string
	/**
	 * The version of the process; set to -1 to use the latest version
	 */
	readonly version: number
	/**
	 * Stringified JSON document that will instantiate the variables for the root variable scope of the
	 * workflow instance; it must be a JSON object, as variables will be mapped in a
	 * key-value fashion. e.g. { "a": 1, "b": 2 } will create two variables, named "a" and
	 * "b" respectively, with their associated values. [{ "a": 1, "b": 2 }] would not be a\
	 * valid argument, as the root of the JSON document is an array and not an object.
	 */
	readonly workflowInstanceKey: string
}

export interface CreateWorkflowInstanceWithResultRequest {
	request: CreateWorkflowInstanceRequest
	// timeout in milliseconds. the request will be closed if the workflow is not completed
	// before the requestTimeout.
	// if requestTimeout = 0, uses the generic requestTimeout configured in the gateway.
	requestTimeout: number
	// list of names of variables to be included in `CreateWorkflowInstanceWithResultResponse.variables`
	// if empty, all visible variables in the root scope will be returned.
	fetchVariables?: string[]
}

export interface CreateWorkflowInstanceWithResultResponse<Result> {
	// the key of the workflow definition which was used to create the workflow instance
	workflowKey: string
	// the BPMN process ID of the workflow definition which was used to create the workflow
	// instance
	bpmnProcessId: string
	// the version of the workflow definition which was used to create the workflow instance
	version: number
	// the unique identifier of the created workflow instance; to be used wherever a request
	// needs a workflow instance key (e.g. CancelWorkflowInstanceRequest)
	workflowInstanceKey: string
	// consisting of all visible variables to the root scope
	variables: Result
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
	readonly brokers: BrokerInfo[]
	readonly clusterSize: number
	readonly partitionsCount: number
	readonly replicationFactor: number
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
	readonly bpmnProcessId: string
	readonly version: number
	readonly workflowKey: string
	readonly resourceName: string
}

export interface DeployWorkflowResponse {
	readonly key: string
	readonly workflows: WorkflowMetadata[]
}

export interface DeployWorkflowRequest {
	readonly workflows: WorkflowRequestObject[]
}

export interface ListWorkflowResponse {
	readonly workflows: WorkflowMetadata[]
}

export interface PublishMessageRequest<Variables = KeyedObject> {
	/** Should match the "Message Name" in a BPMN Message Catch  */
	name: string
	/** The value to match with the field specified as "Subscription Correlation Key" in BPMN */
	correlationKey: string
	/** The number of seconds for the message to buffer on the broker, awaiting correlation. Omit or set to zero for no buffering. */
	timeToLive: MaybeTimeDuration
	/** Unique ID for this message */
	messageId?: string
	variables: Variables
}

export interface PublishStartMessageRequest<Variables = KeyedObject> {
	/** Should match the "Message Name" in a BPMN Message Catch  */
	name: string
	/** The number of seconds for the message to buffer on the broker, awaiting correlation. Omit or set to zero for no buffering. */
	timeToLive: MaybeTimeDuration
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

export interface ThrowErrorRequest {
	// the unique job identifier, as obtained when activating the job
	jobKey: string
	// the error code that will be matched with an error catch event
	errorCode: string
	// an optional error message that provides additional context
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
	elementInstanceKey on the Job message)
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
	readonly version: number
	readonly bpmnProcessId: string
	readonly resourceName: string
	readonly bpmnXml: string
}
