import { MaybeTimeDuration } from 'typed-duration'
import { IInputVariables, IProcessVariables, JSONDoc } from './interfaces-1.0'

export interface StreamActivatedJobsRequest {
	/**
	 * the job type, as defined in the BPMN process (e.g. <zeebe:taskDefinition type="payment-service" />)
	 */
	type: string
	/**
	 * the name of the worker activating the jobs, mostly used for logging purposes
	 */
	worker: string
	/**
	 * a job returned after this call will not be activated by another call until the
	 * timeout (in ms) has been reached
	 */
	timeout: number
	/**
	 * a list of variables to fetch as the job variables; if empty, all visible variables at
	 * the time of activation for the scope of the job will be returned
	 */
	fetchVariable: string[]
	/**
	 * a list of identifiers of tenants for which to stream jobs
	 */
	tenantIds: string[]
  }

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
	/**
	 * a list of IDs of tenants for which to activate jobs
	 */
	tenantIds?: string[]
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
	/**
	 * the id of the tenant that owns the job
	 */
	readonly tenantId : string;
}

export interface ActivateJobsResponse {
	jobs: ActivatedJob[]
}

export interface CreateProcessInstanceBaseRequest {
	/** the BPMN process ID of the process definition */
	bpmnProcessId: string
	/** the version of the process; if not specified it will use the latest version */
	version?: number
	/** JSON document that will instantiate the variables for the root variable scope of the
  	 * process instance.
	 */
	variables: string
	/**
	 * the tenant id of the process definition
	 */
	tenantId?: string
}

export interface CreateProcessInstanceRequest extends CreateProcessInstanceBaseRequest {
	/**
	 * List of start instructions. If empty (default) the process instance
	 * will start at the start event. If non-empty the process instance will apply start
	 * instructions after it has been created
	 */
	startInstructions: ProcessInstanceCreationStartInstruction[]
}

export interface ProcessInstanceCreationStartInstruction {
  /** future extensions might include
   * - different types of start instructions
   * - ability to set local variables for different flow scopes
   * for now, however, the start instruction is implicitly a
   * "startBeforeElement" instruction
   */
	elementId: string;
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
	/**
	 * the tenant identifier of the created process instance
	 */
	readonly tenantId: string;
}

export interface CreateProcessInstanceWithResultRequest {
	request: CreateProcessInstanceBaseRequest
	/** timeout in milliseconds. the request will be closed if the process is not completed before the requestTimeout.
	 * if requestTimeout = 0, uses the generic requestTimeout configured in the gateway.
	 */
	requestTimeout: number
	/** list of names of variables to be included in `CreateProcessInstanceWithResultResponse.variables`.
	 * If empty, all visible variables in the root scope will be returned.
	 */
	fetchVariables?: string[]
}

export interface CreateProcessInstanceWithResultResponse<Result> {
	/**
	 * the key of the process definition which was used to create the process instance
	 */
	readonly processDefinitionKey: string
	/**
	 * the BPMN process ID of the process definition which was used to create the process
	 * instance
	 */
	readonly bpmnProcessId: string
	/**
	 * the version of the process definition which was used to create the process instance
	 */
	readonly version: number
	/**
	 * the unique identifier of the created process instance; to be used wherever a request
	 * needs a process instance key (e.g. CancelProcessInstanceRequest)
	 */
	readonly processInstanceKey: string
	/**
	 * consisting of all visible variables to the root scope
	 */
	readonly variables: Result
	/**
	 * the tenant identifier of the process definition
	 */
	readonly tenantId: string
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
	/** the bpmn process ID, as parsed during deployment; together with the version forms a
	 * unique identifier for a specific process definition */
	readonly bpmnProcessId: string
	/** the assigned process version */
	readonly version: number
	/** the assigned key, which acts as a unique identifier for this process */
	readonly processDefinitionKey: string
	/**
	 * the resource name (see: ProcessRequestObject.name) from which this process was
	 * parsed
	 */
	readonly resourceName: string
	/**
	 * the tenant identifier of the deployed process
	 */
	tenantId: string
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
	/** the tenant id of the deployed decision */
	tenantId: string
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
	//** the tenant id of the deployed decision requirements */
	tenantId: string
}

export interface FormMetadata {
	/**
	 * the form ID, as parsed during deployment; together with the
	 * versions forms a unique identifier for a specific form
	 */
  	readonly formId: string
  	/** the assigned form version */
   	readonly version: number
	/** the assigned key, which acts as a unique identifier for this form */
	readonly formKey: number
  	/** the resource name */
  	readonly resourceName: string
 	/** the tenant id of the deployed form */
  	readonly tenantId: string
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

export interface FormDeployment {
	form: FormMetadata
}

export type Deployment =
	| ProcessDeployment
	| DecisionDeployment
	| DecisionRequirementsDeployment
	| FormDeployment

export interface DeployResourceResponse<T> {
	// the unique key identifying the deployment
	readonly key: number
	// a list of deployed resources, e.g. processes
	readonly deployments: T[]
	/** the tenant id of the deployed resources */
	tenantId: string
}

export interface DeployResourceRequest {
	// list of resources to deploy
	resources: Resource[]
	/**
	 * the tenant id of the resources to deploy
	 */
	tenantId?: string
}

export interface Resource {
	// the resource name, e.g. myProcess.bpmn or myDecision.dmn
	name: string
	// the file content as a UTF8-encoded string
	content: Buffer
}

/**
 * @deprecated since 8, replaced by DeployResourceResponse
 */
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
	timeToLive?: MaybeTimeDuration
	/** Unique ID for this message */
	messageId?: string
	variables?: Variables
	/** the tenantId of the message */
	tenantId?: string
}

export interface PublishMessageResponse {
	/** the unique ID of the message that was published */
	key: number
	/** the tenantId of the message */
	tenantId: string
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
	/** the tenantId for the message */
	tenantId?: string
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
	errorMessage?: string
	/**
	 * JSON document that will instantiate the variables at the local scope of the error catch
	 * event that catches the thrown error; it must be a JSON object, as variables will be mapped in a
	 * key-value fashion. e.g. { "a": 1, "b": 2 } will create two variables, named "a" and
	 * "b" respectively, with their associated values. [{ "a": 1, "b": 2 }] would not be a
	 * valid argument, as the root of the JSON document is an array and not an object.
	 */
	variables?: JSONDoc
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

export interface ActivateInstruction  {
	/** the id of the element that should be activated */
	elementId: string;
	/** the key of the ancestor scope the element instance should be created in;
	 * set to -1 to create the new element instance within an existing element
	 * instance of the flow scope
	 */
	ancestorElementInstanceKey: string;
	/** instructions describing which variables should be created */
	variableInstructions: VariableInstruction[];
}

export interface VariableInstruction {
	/** JSON document that will instantiate the variables for the root variable scope of the
	 * process instance; it must be a JSON object, as variables will be mapped in a
	 * key-value fashion. e.g. { "a": 1, "b": 2 } will create two variables, named "a" and
	 * "b" respectively, with their associated values. [{ "a": 1, "b": 2 }] would not be a
	 * valid argument, as the root of the JSON document is an array and not an object.
	 */
	variables: JSONDoc;
	/** the id of the element in which scope the variables should be created;
	 * leave empty to create the variables in the global scope of the process instance
	 */
	scopeId: string;
}

export interface TerminateInstruction {
	/** the id of the element that should be terminated */
	elementInstanceKey: string;
}

export interface ModifyProcessInstanceRequest {
	/** the key of the process instance that should be modified */
	processInstanceKey: string;
	/** instructions describing which elements should be activated in which scopes,
	 * and which variables should be created
	 */
	activateInstructions?: ActivateInstruction[];
	/** instructions describing which elements should be terminated */
	terminateInstructions?: TerminateInstruction[];
}

export interface ModifyProcessInstanceResponse {
}


export type EvaluateDecisionRequest = {
	/** the unique key identifying the decision to be evaluated (e.g. returned
	 * from a decision in the DeployResourceResponse message)
	 */
	decisionKey: string;
	/** JSON document that will instantiate the variables for the decision to be
	 * 	evaluated; it must be a JSON object, as variables will be mapped in a
	 *  key-value fashion, e.g. { "a": 1, "b": 2 } will create two variables,
	 *  named "a" and "b" respectively, with their associated values.
	 *  [{ "a": 1, "b": 2 }] would not be a valid argument, as the root of the
	 *  JSON document is an array and not an object.
	 */
	variables: JSONDoc;
	/**
	 * the tenant identifier of the decision
	 */
	tenantId?: string
} | {
	/** the ID of the decision to be evaluated */
	decisionId: string;
	/** JSON document that will instantiate the variables for the decision to be
	 * 	evaluated; it must be a JSON object, as variables will be mapped in a
	 *  key-value fashion, e.g. { "a": 1, "b": 2 } will create two variables,
	 *  named "a" and "b" respectively, with their associated values.
	 *  [{ "a": 1, "b": 2 }] would not be a valid argument, as the root of the
	 *  JSON document is an array and not an object.
	 */
	variables: JSONDoc;
	/**
	 * the tenant identifier of the decision
	 */
	tenantId?: string
}

export interface EvaluateDecisionResponse {
	/** the unique key identifying the decision which was evaluated (e.g. returned
	 * from a decision in the DeployResourceResponse message)
	 */
	decisionKey: string;
	/** the ID of the decision which was evaluated */
	decisionId: string;
	/** the name of the decision which was evaluated */
	decisionName: string;
	/** the version of the decision which was evaluated */
	decisionVersion: number;
	/** the ID of the decision requirements graph that the decision which was
	 * evaluated is part of.
	 */
	decisionRequirementsId: string;
	/** the unique key identifying the decision requirements graph that the
	 * decision which was evaluated is part of.
	 */
	decisionRequirementsKey: string;
	/** JSON document that will instantiate the result of the decision which was
	 * evaluated; it will be a JSON object, as the result output will be mapped
	 * in a key-value fashion, e.g. { "a": 1 }.
	 */
	decisionOutput: string;
	/** a list of decisions that were evaluated within the requested decision evaluation */
	evaluatedDecisions: EvaluatedDecision[];
	/** an optional string indicating the ID of the decision which
	 * failed during evaluation
	 */
	failedDecisionId: string;
	/** an optional message describing why the decision which was evaluated failed */
	failureMessage: string;
	/** the tenant identifier of the decision */
	tenantId?: string
}

export interface EvaluatedDecision {
	/** the unique key identifying the decision which was evaluated (e.g. returned
	 * from a decision in the DeployResourceResponse message)
	 */
	decisionKey: string;
	/** the ID of the decision which was evaluated */
	decisionId: string;
	/** the name of the decision which was evaluated */
	decisionName: string;
	/** the version of the decision which was evaluated */
	decisionVersion: number;
	/** the type of the decision which was evaluated */
	decisionType: string;
	/** JSON document that will instantiate the result of the decision which was
	 * evaluated; it will be a JSON object, as the result output will be mapped
	 * in a key-value fashion, e.g. { "a": 1 }.
	 */
	decisionOutput: string;
	/** the decision rules that matched within this decision evaluation */
	matchedRules: MatchedDecisionRule[];
	/** the decision inputs that were evaluated within this decision evaluation */
	evaluatedInputs: EvaluatedDecisionInput[];
	/** the tenant identifier of the evaluated decision */
	tenantId: string
}

export interface EvaluatedDecisionInput {
	/** the id of the evaluated decision input */
	inputId: string;
	/** the name of the evaluated decision input */
	inputName: string;
	/** the value of the evaluated decision input */
	inputValue: string;
}

export interface EvaluatedDecisionOutput {
	/** the id of the evaluated decision output */
	outputId: string;
	/** the name of the evaluated decision output */
	outputName: string;
	/** the value of the evaluated decision output */
	outputValue: string;
}

export interface MatchedDecisionRule {
	/** the id of the matched rule */
	ruleId: string;
	/** the index of the matched rule */
	ruleIndex: number;
	/** the evaluated decision outputs */
	evaluatedOutputs: EvaluatedDecisionOutput[];
}

export interface BroadcastSignalRequest {
	// The name of the signal
	signalName: string;

	// the signal variables as a JSON document; to be valid, the root of the document must be an
  	// object, e.g. { "a": "foo" }. [ "foo" ] would not be valid.
	variables: string;
}

export interface BroadcastSignalResponse {
  	// the unique ID of the signal that was broadcasted.
	key: string
}
