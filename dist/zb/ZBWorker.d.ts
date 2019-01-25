import { Chalk } from "chalk";
import * as ZB from "../lib/interfaces";
import { ZBWorkerLogger } from "../lib/ZBWorkerLogger";
export declare class ZBWorker {
    gRPCClient: any;
    activeJobs: number;
    taskType: string;
    maxActiveJobs: number;
    timeout: number;
    private taskHandler;
    private id;
    private pollInterval;
    private errored;
    private onConnectionErrorHandler?;
    private defaultLogger;
    constructor(gRPCClient: any, id: string, taskType: string, taskHandler: ZB.ZBWorkerTaskHandler, options: ZB.ZBWorkerOptions | undefined, idColor: Chalk, onConnectionError?: ZB.ConnectionErrorHandler);
    work: () => void;
    completeJob(completeJobRequest: ZB.CompleteJobRequest): Promise<void>;
    onConnectionError(handler: (error: any) => void): void;
    log(msg: any): void;
    getNewLogger(options: ZB.ZBWorkerLoggerOptions): ZBWorkerLogger;
    private internalLog;
    private handleGrpcError;
    private activateJobs;
}
