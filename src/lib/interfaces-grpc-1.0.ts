import { MaybeTimeDuration } from 'typed-duration'
import { IInputVariables, IProcessVariables } from './interfaces-1.0'

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
	/** The job's process instance key */
	readonly processInstanceKey: string
	/** The bpmn process ID of the job process definition */
	readonly bpmnProcessId: string
	/** The version of the job process definition */
	readonly processDefinitionVersion: number
	/** The key of the job process definition */
	readonly processDefinitionKey: string
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

export interface CreateProcessInstanceRequest<Variables = IProcessVariables> {
	bpmnProcessId: string
	version?: number
	variables: Variables
}

export interface CreateProcessInstanceResponse {
	/**
	 * The unique key identifying the process definition (e.g. returned from a process
	 * in the DeployProcessResponse message)
	 */
	readonly processDefinitionKey: string
	/**
	 * The BPMN process ID of the process definition
	 */
	readonly bpmnProcessId: string
	/**
	 * The version of the process; set to -1 to use the latest version
	 */
	readonly version: number
	/**
	 * Stringified JSON document that will instantiate the variables for the root variable scope of the
	 * process instance; it must be a JSON object, as variables will be mapped in a
	 * key-value fashion. e.g. { "a": 1, "b": 2 } will create two variables, named "a" and
	 * "b" respectively, with their associated values. [{ "a": 1, "b": 2 }] would not be a\
	 * valid argument, as the root of the JSON document is an array and not an object.
	 */
	readonly processInstanceKey: string
}

export interface CreateProcessInstanceWithResultRequest {
	request: CreateProcessInstanceRequest
	// timeout in milliseconds. the request will be closed if the process is not completed
	// before the requestTimeout.
	// if requestTimeout = 0, uses the generic requestTimeout configured in the gateway.
	requestTimeout: number
	// list of names of variables to be included in `CreateProcessInstanceWithResultResponse.variables`
	// if empty, all visible variables in the root scope will be returned.
	fetchVariables?: string[]
}

export interface CreateProcessInstanceWithResultResponse<Result> {
	// the key of the process definition which was used to create the process instance
	processDefinitionKey: string
	// the BPMN process ID of the process definition which was used to create the process
	// instance
	bpmnProcessId: string
	// the version of the process definition which was used to create the process instance
	version: number
	// the unique identifier of the created process instance; to be used wherever a request
	// needs a process instance key (e.g. CancelProcessInstanceRequest)
	processInstanceKey: string
	// consisting of all visible variables to the root scope
	variables: Result
}

// Describes the Raft role of the broker for a given partition
export enum PartitionBrokerRole {
	LEADER = 0,
	BROKER = 1,
	INACTIVE = 2,
}

// Describes the current health of the partition
export enum PartitionBrokerHealth {
	HEALTHY = 0,
	UNHEALTHY = 1,
	DEAD = 2,
}

export interface Partition {
	partitionId: number
	// the role of the broker for this partition
	role: PartitionBrokerRole
	// the health of this partition
	health: PartitionBrokerHealth
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
	readonly gatewayVersion: string
}

export interface ProcessRequestObject {
	name?: string
	definition: Buffer // bytes, actually
}

export interface ProcessMetadata {
	readonly bpmnProcessId: string
	readonly version: number
	readonly processDefinitionKey: string
	readonly resourceName: string
}

export interface DecisionMetadata {
	// the dmn decision ID, as parsed during deployment; together with the
	// versions forms a unique identifier for a specific decision
	dmnDecisionId: string
	// the dmn name of the decision, as parsed during deployment
	dmnDecisionName: string
	// the assigned decision version
	version: number
	// the assigned decision key, which acts as a unique identifier for this
	// decision
	decisionKey: number
	// the dmn ID of the decision requirements graph that this decision is part
	// of, as parsed during deployment
	dmnDecisionRequirementsId: string
	// the assigned key of the decision requirements graph that this decision is
	// part of
	decisionRequirementsKey: number
}

export interface DecisionRequirementsMetadata {
	// the dmn decision requirements ID, as parsed during deployment; together
	// with the versions forms a unique identifier for a specific decision
	dmnDecisionRequirementsId: string
	// the dmn name of the decision requirements, as parsed during deployment
	dmnDecisionRequirementsName: string
	// the assigned decision requirements version
	version: number
	// the assigned decision requirements key, which acts as a unique identifier
	// for this decision requirements
	decisionRequirementsKey: number
	// the resource name (see: Resource.name) from which this decision
	// requirements was parsed
	resourceName: string
}

export interface ProcessDeployment {
	process: ProcessMetadata
}
export interface DecisionDeployment {
	decision: DecisionMetadata
}
export interface DecisionRequirementsDeployment {
	decisionRequirements: DecisionRequirementsMetadata
}
export type Deployment =
	| ProcessDeployment
	| DecisionDeployment
	| DecisionRequirementsDeployment

export interface DeployResourceResponse<T> {
	// the unique key identifying the deployment
	readonly key: number
	// a list of deployed resources, e.g. processes
	readonly deployments: T[]
}

export interface DeployResourceRequest {
	// list of resources to deploy
	resources: Resource[]
}

export interface Resource {
	// the resource name, e.g. myProcess.bpmn or myDecision.dmn
	name: string
	// the file content as a UTF8-encoded string
	content: Buffer
}

export interface DeployProcessResponse {
	readonly key: string
	readonly processes: ProcessMetadata[]
}

export interface DeployProcessRequest {
	readonly processes: ProcessRequestObject[]
}

export interface ListProcessResponse {
	readonly processes: ProcessMetadata[]
}

export interface PublishMessageRequest<Variables = IInputVariables> {
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

export interface PublishMessageResponse {
	// the unique ID of the message that was published
	key: number
}

export interface PublishStartMessageRequest<Variables = IProcessVariables> {
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
	retryBackOff: number
}

export interface ThrowErrorRequest {
	// the unique job identifier, as obtained when activating the job
	jobKey: string
	// the error code that will be matched with an error catch event
	errorCode: string
	// an optional error message that provides additional context
	errorMessage: string
}

export interface CompleteJobRequest<Variables = IProcessVariables> {
	readonly jobKey: string
	variables: Variables
}

export interface SetVariablesRequest<Variables = IProcessVariables> {
	/*
	The unique identifier of a particular element; can be the process instance key (as
	obtained during instance creation), or a given element, such as a service task (see
	elementInstanceKey on the Job message)
	*/
	readonly elementInstanceKey: string
	variables: Partial<Variables>
	/**
	 *  if true, the variables will be merged strictly into the local scope (as indicated by
	 *  elementInstanceKey); this means the variables is not propagated to upper scopes.
	 *  for example, let's say we have two scopes, '1' and '2', with each having effective variables as:
	 * 1 => `{ "foo" : 2 }`, and 2 => `{ "bar" : 1 }`. if we send an update request with
	 * elementInstanceKey = 2, variables `{ "foo" : 5 }`, and local is true, then scope 1 will
	 * be unchanged, and scope 2 will now be `{ "bar" : 1, "foo" 5 }`. if local was false, however,
	 * then scope 1 would be `{ "foo": 5 }`, and scope 2 would be `{ "bar" : 1 }`.
	 */
	local: boolean
}

export interface ResolveIncidentRequest {
	readonly incidentKey: string
}
