import { ICustomHeaders, IInputVariables, IOutputVariables, MustReturnJobActionAcknowledgement, ZeebeJob } from "./interfaces-1.0";

export class ZeebeJobMock implements ZeebeJob {
	key: string;
	type: string;
	processInstanceKey: string;
	bpmnProcessId: string;
	processDefinitionVersion: number;
	processKey: string;
	elementId: string;
	elementInstanceKey: string;
	customHeaders: Readonly<ICustomHeaders>;
	worker: string;
	retries: number;
	deadline: string;
	variables: Readonly<IInputVariables>;
	cancelWorkflow: () => Promise<"JOB_ACTION_ACKNOWLEDGEMENT">;
	complete: (updatedVariables?: IOutputVariables | undefined) => Promise<"JOB_ACTION_ACKNOWLEDGEMENT">;
	fail: { (errorMessage: string, retries?: number | undefined): Promise<"JOB_ACTION_ACKNOWLEDGEMENT">;  };
	forward: () => "JOB_ACTION_ACKNOWLEDGEMENT";
	error: (errorCode: string, errorMessage?: string | undefined) => Promise<"JOB_ACTION_ACKNOWLEDGEMENT">;

	completed?: IOutputVariables
	failed?: {errorMessage: string, retries: number}
	forwarded: boolean = false
	errored?: {errorCode: string, errorMessage?: string} 

	constructor(res:
		{variables?: IInputVariables, customHeaders?: ICustomHeaders}) {
			this.variables = res.variables || {}
			this.customHeaders = res.customHeaders || {}
	}
}

export class ZeebeWorkerMock {
	taskHandler: (job: ZeebeJob) => MustReturnJobActionAcknowledgement;
	constructor(taskHandler: (job:ZeebeJob) => MustReturnJobActionAcknowledgement) {
		this.taskHandler = taskHandler
	}

	call(job: ZeebeJobMock) {

	}
}
