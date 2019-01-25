/// <reference types="node" />
import { Chalk } from "chalk";
import { ZBWorker } from "../zb/ZBWorker";
export declare type Payload = any;
export declare type completeFn = (updatedPayload?: any) => void;
export declare type ZBTaskWorkerHandlerMinimal = (payload: Job, complete: completeFn) => void;
export declare type ZBWorkerTaskHandlerWithWorker = (payload: Job, complete: completeFn, worker: ZBWorker) => void;
export declare type ZBWorkerTaskHandler = ZBTaskWorkerHandlerMinimal | ZBWorkerTaskHandlerWithWorker;
export interface ZBWorkerLoggerOptions {
    level?: string;
    color?: Chalk;
    namespace?: string | string[];
}
export declare type ConnectionErrorHandler = (error: any) => void;
export interface ActivateJobsResponse {
    jobs: ActivatedJob[];
}
/**
 * Request object to send the broker to request jobs for the worker.
 */
export interface ActivateJobsRequest {
    type: string;
    worker: string;
    timeout: number;
    amount: number;
    fetchVariable?: string[];
}
export interface ActivatedJob {
    key: string;
    type: string;
    jobHeaders: JobHeaders;
    /**
     * JSON object as a string
     */
    customHeaders: string;
    worker: string;
    retries: number;
    /**
     * epoch milliseconds
     */
    deadline: string;
    /**
     * JSON object as a string
     */
    payload: string;
}
export interface Job {
    key: string;
    type: string;
    jobHeaders: JobHeaders;
    customHeaders: Payload;
    worker: string;
    retries: number;
    deadline: string;
    payload: Payload;
}
export interface JobHeaders {
    workflowInstanceKey: string;
    bpmnProcessId: string;
    workflowDefinitionVersion: number;
    workflowKey: string;
    elementId: string;
    elementInstanceKey: string;
}
export interface ZBWorkerOptions {
    /**
     * Max concurrent tasks for this worker. Default 32.
     */
    maxActiveJobs?: number;
    /**
     * Max ms to allow before time out of a task given to this worker. Default: 1000ms.
     */
    timeout?: number;
    /**
     * Poll Interval in ms. Default 100.
     */
    pollInterval?: number;
    /**
     * Constrain payload to these keys only.
     */
    fetchVariables?: string[];
    /**
     * This handler is called when the worker cannot connect to the broker, or loses its connection.
     */
    onConnectionErrorHandler?: ConnectionErrorHandler;
}
export interface CreateWorkflowInstanceRequest {
    bpmnProcessId: string;
    version?: number;
    payload: Payload;
}
export interface CreateWorkflowInstanceResponse {
    workflowKey: string;
    bpmnProcessId: string;
    version: number;
    workflowInstanceKey: string;
}
export declare enum PartitionBrokerRole {
    LEADER = 0,
    BROKER = 1
}
export interface Partition {
    partitionId: number;
    role: PartitionBrokerRole;
}
export interface BrokerInfo {
    nodeId: number;
    host: string;
    port: number;
    partitions: Partition[];
}
export interface TopologyResponse {
    brokers: BrokerInfo[];
    clusterSize: number;
    partitionsCount: number;
    replicationFactor: number;
}
export declare enum ResourceType {
    FILE = 0,
    BPMN = 1,
    YAML = 2
}
export interface WorkflowRequestObject {
    name?: string;
    type?: ResourceType;
    definition: Buffer;
}
export interface WorkflowMetadata {
    bpmnProcessId: string;
    version: number;
    workflowKey: string;
    resourceName: string;
}
export interface DeployWorkflowResponse {
    key: number;
    workflows: WorkflowMetadata[];
}
export interface DeployWorkflowRequest {
    workflows: WorkflowRequestObject[];
}
export interface ListWorkflowResponse {
    workflows: WorkflowMetadata[];
}
export interface PublishMessageRequest {
    /** Should match the "Message Name" in a BPMN Message Catch  */
    name: string;
    /** The value to match with the field specified as "Subscription Correlation Key" in BPMN */
    correlationKey: string;
    timeToLive: number;
    /** Unique ID for this message */
    messageId?: string;
    payload: Payload;
}
export interface PublishStartMessageRequest {
    /** Should match the "Message Name" in a BPMN Message Catch  */
    name: string;
    timeToLive: number;
    /** Unique ID for this message */
    messageId?: string;
    payload: Payload;
}
export interface UpdateJobRetriesRequest {
    jobKey: string;
    retries: number;
}
export interface FailJobRequest {
    jobKey: string;
    retries: number;
    errorMessage: string;
}
export interface CompleteJobRequest {
    jobKey: string;
    payload: Payload;
}
export interface UpdateWorkflowInstancePayloadRequest {
    elementInstanceKey: string;
    payload: Payload;
}
export declare type GetWorkflowRequest = GetWorkflowRequestWithBpmnProcessId | GetWorkflowRequestWithWorkflowKey;
export interface GetWorkflowRequestWithWorkflowKey {
    workflowKey: string;
}
export interface GetWorkflowRequestWithBpmnProcessId {
    /** by default set version = -1 to indicate to use the latest version */
    version?: number;
    bpmnProcessId: string;
}
export interface GetWorkflowResponse {
    workflowKey: string;
    version: number;
    bpmnProcessId: string;
    resourceName: string;
    bpmnXml: string;
}
