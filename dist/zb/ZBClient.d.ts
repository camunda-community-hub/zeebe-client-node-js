import * as ZB from "../lib/interfaces";
import { ZBWorker } from "./ZBWorker";
export declare class ZBClient {
    brokerAddress: string;
    private gRPCClient;
    constructor(brokerAddress: string);
    /**
     *
     * @param id - A unique identifier for this worker.
     * @param taskType - The BPMN Zeebe task type that this worker services.
     * @param taskHandler - A handler for activated jobs.
     * @param options - Configuration options for the worker.
     */
    createWorker(id: string, taskType: string, taskHandler: ZB.taskHandlerFn, options?: ZB.ZBWorkerOptions): ZBWorker;
    /**
     * Return the broker cluster topology
     */
    topology(): Promise<ZB.TopologyResponse>;
    /**
     *
     * @param workflow - A path or array of paths to .bpmn files.
     * @param {redeploy?: boolean} - Redeploy workflow. Defaults to true.
     * If set false, will not redeploy a workflow that exists.
     */
    deployWorkflow(workflow: string | string[], { redeploy }?: {
        redeploy?: boolean | undefined;
    }): Promise<ZB.DeployWorkflowResponse>;
    /**
     * Return an array of task-types specified in a BPMN file.
     * @param file - Path to bpmn file.
     */
    getServiceTypesFromBpmn(files: string | string[]): Promise<string[]>;
    /**
     * Publish a message to the broker for correlation with a workflow instance.
     * @param publishMessageRequest - The message to publish.
     */
    publishMessage(publishMessageRequest: ZB.PublishMessageRequest): Promise<void>;
    /**
     * Publish a message to the broker for correlation with a workflow message start event.
     * @param publishStartMessageRequest - The message to publish.
     */
    publishStartMessage(publishStartMessageRequest: ZB.PublishStartMessageRequest): Promise<void>;
    updateJobRetries(updateJobRetriesRequest: ZB.UpdateJobRetriesRequest): Promise<void>;
    failJob(failJobRequest: ZB.FailJobRequest): Promise<void>;
    /**
     *
     * Create and start execution of a workflow instance.
     * @param {string} bpmnProcessId
     * @param {Payload} payload - payload to pass in to the workflow
     * @param {number} [version] - version of the workflow to run. Optional: defaults to latest if not present
     * @returns {Promise<CreateWorkflowInstanceResponse>}
     * @memberof ZBClient
     */
    createWorkflowInstance(bpmnProcessId: string, payload: ZB.Payload, version?: number): Promise<ZB.CreateWorkflowInstanceResponse>;
    cancelWorkflowInstance(workflowInstanceKey: string): Promise<void>;
    updateWorkflowInstancePayload(request: ZB.UpdateWorkflowInstancePayloadRequest): Promise<void>;
    listWorkflows(bpmnProcessId?: string): Promise<ZB.ListWorkflowResponse>;
    getWorkflow(getWorkflowRequest: ZB.GetWorkflowRequest): Promise<ZB.GetWorkflowResponse>;
    resolveIncident(incidentKey: string): Promise<void>;
    private hasBpmnProcessId;
}
