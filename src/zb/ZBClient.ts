import chalk from 'chalk'
import * as fs from 'fs'
import * as GRPCClient from 'node-grpc-client'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import { BpmnParser, stringifyVariables } from '../lib'
import * as ZB from '../lib/interfaces'
import { KeyedObject } from '../lib/interfaces'
import { ZBWorker } from './ZBWorker'

const idColors = [
	chalk.yellow,
	chalk.green,
	chalk.cyan,
	chalk.magenta,
	chalk.blue,
]

export class ZBClient {
	public gatewayAddress: string
	private closePromise?: Promise<any>
	private closing = false
	private gRPCClient: any
	private options: ZB.ZBClientOptions
	private workerCount = 0
	private workers: Array<ZBWorker<any, any, any>> = []

	constructor(gatewayAddress: string, options: ZB.ZBClientOptions = {}) {
		if (!gatewayAddress) {
			throw new Error(
				'Must provide a gateway address string to constructor'
			)
		}
		this.options = options || {}
		this.options.loglevel =
			(process.env.ZB_NODE_LOG_LEVEL as ZB.Loglevel) ||
			options.loglevel ||
			'INFO'

		if (gatewayAddress.indexOf(':') === -1) {
			gatewayAddress += ':26500'
		}

		this.gatewayAddress = gatewayAddress

		this.gRPCClient = new GRPCClient(
			path.join(__dirname, '../../proto/zeebe.proto'),
			'gateway_protocol',
			'Gateway',
			gatewayAddress
		)
	}

	/**
	 *
	 * @param id - A unique identifier for this worker.
	 * @param taskType - The BPMN Zeebe task type that this worker services.
	 * @param taskHandler - A handler for activated jobs.
	 * @param options - Configuration options for the worker.
	 */
	public createWorker<
		WorkerInputVariables = KeyedObject,
		CustomHeaderShape = KeyedObject,
		WorkerOutputVariables = WorkerInputVariables
	>(
		id: string,
		taskType: string,
		taskHandler: ZB.ZBWorkerTaskHandler<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>,
		options: ZB.ZBWorkerOptions & ZB.ZBClientOptions = {},
		onConnectionError?: ZB.ConnectionErrorHandler | undefined
	) {
		if (this.closing) {
			throw new Error('Client is closing. No worker creation allowed!')
		}
		const idColor = idColors[this.workerCount++ % idColors.length]
		const worker = new ZBWorker<
			WorkerInputVariables,
			CustomHeaderShape,
			WorkerOutputVariables
		>({
			gRPCClient: this.gRPCClient,
			id,
			idColor,
			onConnectionError,
			options: { ...this.options, ...options },
			taskHandler,
			taskType,
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
	public close() {
		if (this.closePromise) {
			return this.closePromise
		}
		// Prevent the creation of more workers
		this.closing = true
		this.closePromise = Promise.all(this.workers.map(w => w.close()))
		return this.closePromise
	}

	/**
	 * Return the broker cluster topology
	 */
	public topology(): Promise<ZB.TopologyResponse> {
		return this.gRPCClient.topologySync()
	}

	/**
	 *
	 * @param workflow - A path or array of paths to .bpmn files.
	 * @param {redeploy?: boolean} - Redeploy workflow. Defaults to true.
	 * If set false, will not redeploy a workflow that exists.
	 */
	public async deployWorkflow(
		workflow: string | string[],
		{ redeploy = true } = {}
	): Promise<ZB.DeployWorkflowResponse> {
		const workflows = Array.isArray(workflow) ? workflow : [workflow]
		let deployedWorkflows: any[] = []
		if (!redeploy) {
			deployedWorkflows = (await this.listWorkflows()).workflows.map(
				(wf: any) => wf.bpmnProcessId
			)
		}
		const workFlowRequests: ZB.WorkflowRequestObject[] = workflows
			.map(wf => ({
				definition: fs.readFileSync(wf),
				name: path.basename(wf),
				type: 1,
			}))
			.filter(
				wfr =>
					!deployedWorkflows.includes(
						BpmnParser.getProcessId(wfr.definition.toString())
					)
			)
		if (workFlowRequests.length > 0) {
			return this.gRPCClient.deployWorkflowSync({
				workflows: workFlowRequests,
			})
		} else {
			return {
				key: -1,
				workflows: [],
			}
		}
	}

	/**
	 * Return an array of task-types specified in a BPMN file.
	 * @param file - Path to bpmn file.
	 */
	public getServiceTypesFromBpmn(files: string | string[]) {
		if (typeof files === 'string') {
			files = [files]
		}
		return BpmnParser.getTaskTypes(BpmnParser.parseBpmn(files))
	}

	/**
	 * Publish a message to the broker for correlation with a workflow instance.
	 * @param publishMessageRequest - The message to publish.
	 */
	public publishMessage<T = KeyedObject>(
		publishMessageRequest: ZB.PublishMessageRequest<T>
	): Promise<void> {
		return this.gRPCClient.publishMessageSync(
			stringifyVariables(publishMessageRequest)
		)
	}

	/**
	 * Publish a message to the broker for correlation with a workflow message start event.
	 * @param publishStartMessageRequest - The message to publish.
	 */
	public publishStartMessage<T = KeyedObject>(
		publishStartMessageRequest: ZB.PublishStartMessageRequest<T>
	): Promise<void> {
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

		const publishMessageRequest: ZB.PublishMessageRequest = {
			correlationKey: uuid(),
			...publishStartMessageRequest,
		}
		return this.gRPCClient.publishMessageSync(
			stringifyVariables(publishMessageRequest)
		)
	}

	public updateJobRetries(
		updateJobRetriesRequest: ZB.UpdateJobRetriesRequest
	): Promise<void> {
		return this.gRPCClient.updateJobRetriesSync(updateJobRetriesRequest)
	}

	public failJob(failJobRequest: ZB.FailJobRequest): Promise<void> {
		return this.gRPCClient.failJobSync(failJobRequest)
	}

	/**
	 *
	 * Create and start execution of a workflow instance.
	 * @param {string} bpmnProcessId
	 * @param {Variables} variables - payload to pass in to the workflow
	 * @param {number} [version] - version of the workflow to run. Optional: defaults to latest if not present
	 * @returns {Promise<CreateWorkflowInstanceResponse>}
	 * @memberof ZBClient
	 */
	public createWorkflowInstance<Variables = KeyedObject>(
		bpmnProcessId: string,
		variables: Variables,
		version?: number
	): Promise<ZB.CreateWorkflowInstanceResponse> {
		version = version || -1

		const createWorkflowInstanceRequest: ZB.CreateWorkflowInstanceRequest = {
			bpmnProcessId,
			variables: (variables as unknown) as object,
			version,
		}
		return this.gRPCClient.createWorkflowInstanceSync(
			stringifyVariables(createWorkflowInstanceRequest)
		)
	}

	public async cancelWorkflowInstance(
		workflowInstanceKey: string
	): Promise<void> {
		return this.gRPCClient.cancelWorkflowInstanceSync({
			workflowInstanceKey,
		})
	}

	public setVariables<Variables = KeyedObject>(
		request: ZB.SetVariablesRequest<Variables>
	): Promise<void> {
		/*
		We allow developers to interact with variables as a native JS object, but the Zeebe server needs it as a JSON document
		So we stringify it here.
		*/
		if (typeof request.variables === 'object') {
			request.variables = JSON.stringify(request.variables) as any
		}
		return this.gRPCClient.setVariablesSync(request)
	}

	public listWorkflows(
		bpmnProcessId?: string
	): Promise<ZB.ListWorkflowResponse> {
		return this.gRPCClient.listWorkflowsSync({ bpmnProcessId })
	}

	public getWorkflow(
		getWorkflowRequest: ZB.GetWorkflowRequest
	): Promise<ZB.GetWorkflowResponse> {
		if (this.hasBpmnProcessId(getWorkflowRequest)) {
			getWorkflowRequest.version = getWorkflowRequest.version || -1
		}
		return this.gRPCClient.getWorkflowSync(getWorkflowRequest)
	}

	public resolveIncident(incidentKey: string): Promise<void> {
		return this.gRPCClient.resolveIncidentSync(incidentKey)
	}

	private hasBpmnProcessId(
		request: ZB.GetWorkflowRequest
	): request is ZB.GetWorkflowRequestWithBpmnProcessId {
		return (
			(request as ZB.GetWorkflowRequestWithBpmnProcessId)
				.bpmnProcessId !== undefined
		)
	}
}
