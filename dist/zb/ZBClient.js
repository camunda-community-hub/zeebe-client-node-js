"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const GRPCClient = require("node-grpc-client");
const path = require("path");
const lib_1 = require("../lib");
const ZBWorker_1 = require("./ZBWorker");
const chalk_1 = require("chalk");
const idColors = [
    chalk_1.default.yellow,
    chalk_1.default.green,
    chalk_1.default.cyan,
    chalk_1.default.magenta,
    chalk_1.default.blue,
];
class ZBClient {
    constructor(brokerAddress) {
        this.workerCount = 0;
        if (!brokerAddress) {
            throw new Error("Must provide a broker address string to constructor");
        }
        if (brokerAddress.indexOf(":") === -1) {
            brokerAddress += ":26500";
        }
        this.brokerAddress = brokerAddress;
        this.gRPCClient = new GRPCClient(path.join(__dirname, "../../proto/zeebe.proto"), "gateway_protocol", "Gateway", brokerAddress);
    }
    /**
     *
     * @param id - A unique identifier for this worker.
     * @param taskType - The BPMN Zeebe task type that this worker services.
     * @param taskHandler - A handler for activated jobs.
     * @param options - Configuration options for the worker.
     */
    createWorker(id, taskType, taskHandler, options = {}, onConnectionError) {
        const idColor = idColors[this.workerCount++ % idColors.length];
        return new ZBWorker_1.ZBWorker(this.gRPCClient, id, taskType, taskHandler, options, idColor, onConnectionError);
    }
    /**
     * Return the broker cluster topology
     */
    topology() {
        return this.gRPCClient.topologySync();
    }
    /**
     *
     * @param workflow - A path or array of paths to .bpmn files.
     * @param {redeploy?: boolean} - Redeploy workflow. Defaults to true.
     * If set false, will not redeploy a workflow that exists.
     */
    async deployWorkflow(workflow, { redeploy = true } = {}) {
        const workflows = Array.isArray(workflow) ? workflow : [workflow];
        let deployedWorkflows = [];
        if (!redeploy) {
            deployedWorkflows = (await this.listWorkflows()).workflows.map((wf) => wf.bpmnProcessId);
        }
        const workFlowRequests = workflows
            .map((wf) => ({
            definition: fs.readFileSync(wf),
            name: path.basename(wf),
            type: 1,
        }))
            .filter((wfr) => !deployedWorkflows.includes(lib_1.BpmnParser.getProcessId(wfr.definition.toString())));
        if (workFlowRequests.length > 0) {
            return this.gRPCClient.deployWorkflowSync({ workflows: workFlowRequests });
        }
        else {
            return {
                key: -1,
                workflows: [],
            };
        }
    }
    /**
     * Return an array of task-types specified in a BPMN file.
     * @param file - Path to bpmn file.
     */
    getServiceTypesFromBpmn(files) {
        if (typeof files === "string") {
            files = [files];
        }
        return lib_1.BpmnParser.getTaskTypes(lib_1.BpmnParser.parseBpmn(files));
    }
    /**
     * Publish a message to the broker for correlation with a workflow instance.
     * @param publishMessageRequest - The message to publish.
     */
    publishMessage(publishMessageRequest) {
        return this.gRPCClient.publishMessageSync(lib_1.stringifyPayload(publishMessageRequest));
    }
    /**
     * Publish a message to the broker for correlation with a workflow message start event.
     * @param publishStartMessageRequest - The message to publish.
     */
    publishStartMessage(publishStartMessageRequest) {
        const publishMessageRequest = Object.assign({ correlationKey: "__MESSAGE_START_EVENT__" }, publishStartMessageRequest);
        return this.gRPCClient.publishMessageSync(lib_1.stringifyPayload(publishMessageRequest));
    }
    updateJobRetries(updateJobRetriesRequest) {
        return this.gRPCClient.updateJobRetriesSync(updateJobRetriesRequest);
    }
    failJob(failJobRequest) {
        return this.gRPCClient.failJobSync(failJobRequest);
    }
    /**
     *
     * Create and start execution of a workflow instance.
     * @param {string} bpmnProcessId
     * @param {Payload} payload - payload to pass in to the workflow
     * @param {number} [version] - version of the workflow to run. Optional: defaults to latest if not present
     * @returns {Promise<CreateWorkflowInstanceResponse>}
     * @memberof ZBClient
     */
    createWorkflowInstance(bpmnProcessId, payload, version) {
        version = version || -1;
        const createWorkflowInstanceRequest = {
            bpmnProcessId,
            payload,
            version,
        };
        return this.gRPCClient.createWorkflowInstanceSync(lib_1.stringifyPayload(createWorkflowInstanceRequest));
    }
    cancelWorkflowInstance(workflowInstanceKey) {
        return this.gRPCClient.cancelWorkflowInstanceSync(workflowInstanceKey);
    }
    updateWorkflowInstancePayload(request) {
        return this.gRPCClient.updateWorkflowInstancePayloadRequestSync(lib_1.stringifyPayload(request));
    }
    listWorkflows(bpmnProcessId) {
        return this.gRPCClient.listWorkflowsSync({ bpmnProcessId });
    }
    getWorkflow(getWorkflowRequest) {
        if (this.hasBpmnProcessId(getWorkflowRequest)) {
            getWorkflowRequest.version = getWorkflowRequest.version || -1;
        }
        return this.gRPCClient.getWorkflowSync(getWorkflowRequest);
    }
    resolveIncident(incidentKey) {
        return this.gRPCClient.resolveIncidentSync(incidentKey);
    }
    hasBpmnProcessId(request) {
        return request.bpmnProcessId !== undefined;
    }
}
exports.ZBClient = ZBClient;
//# sourceMappingURL=ZBClient.js.map