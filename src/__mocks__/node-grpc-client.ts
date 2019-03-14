export = class GRPCClient {
	public protoFilePath: string
	public protocolName: string
	public serviceName: string
	public grpcServeraddress: string

	public deployedWorkflows: string[] = []

	constructor(
		protoFilePath: string,
		protocolName: string,
		serviceName: string,
		grpcServeraddress: string
	) {
		this.protoFilePath = protoFilePath
		this.protocolName = protocolName
		this.serviceName = serviceName
		this.grpcServeraddress = grpcServeraddress
	}

	public activateJobsStream() {
		return null
	}

	public cancelWorkflowInstanceSync() {
		return null
	}

	public completeJobSync() {
		return null
	}

	public createWorkflowInstanceSync() {
		return null
	}

	public deployWorkflowSync(wfr: any) {
		// @TODO: Parse out processId and pass back
		const res = wfr.workflows.map((wf: any) => ({
			bpmnProcessId: 'hello-world',
			resourceName: wf.name,
			version: 1,
			workflowKey: '381010',
		}))
		return { workflows: res }
	}

	public failJobSync() {
		return null
	}

	public getWorkflowSync() {
		return null
	}

	public listWorkflowsSync() {
		return {
			workflows: [
				{
					bpmnProcessId: 'hello-world',
					resourceName: 'hello-world.bpmn',
					version: 1,
					workflowKey: '1',
				},
			],
		}
	}

	public publishMessageSync() {
		return null
	}

	public resolveIncidentSync() {
		return null
	}

	public topologySync() {
		return null
	}

	public updateJobRetriesSync() {
		return null
	}

	public updateWorkflowInstancePayloadRequestSync() {
		return null
	}
}
