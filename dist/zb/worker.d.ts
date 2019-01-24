import * as ZB from "../lib/interfaces";
export declare class ZBWorker {
    gRPCClient: any;
    activeJobs: number;
    taskType: string;
    private taskHandler;
    private options;
    private id;
    private pollInterval;
    private errored;
    private onConnectionErrorHandler?;
    constructor(gRPCClient: any, id: string, taskType: string, taskHandler: ZB.taskHandlerFn, options?: ZB.ZBWorkerOptions, onConnectionError?: ZB.ConnectionErrorHandler);
    work: () => void;
    completeJob(completeJobRequest: ZB.CompleteJobRequest): Promise<void>;
    onConnectionError(handler: (error: any) => void): void;
    private log;
    private handleGrpcError;
    private activateJobs;
}
