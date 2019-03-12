import chalk, { Chalk } from "chalk";

import debug = require("debug");
import * as uuid from "uuid";
import { parsePayload, stringifyPayload } from "../lib";
import * as ZB from "../lib/interfaces";
import { ZBWorkerLogger } from "../lib/ZBWorkerLogger";
// tslint:disable-next-line
require("console-stamp")(console, "[HH:MM:ss.l]");

const log = debug("zeebe-node:worker");

export class ZBWorker {
    public activeJobs = 0;
    public gRPCClient: any;
    public maxActiveJobs: number;
    public taskType: string;
    public timeout: number;

    private closeCallback?: () => void;
    private closePromise?: Promise<undefined>;
    private closing = false;
    private closed = false;
    private defaultLogger: ZBWorkerLogger;
    private errored = false;
    private id = uuid.v4();
    private onConnectionErrorHandler?: ZB.ConnectionErrorHandler;
    private pollHandle?: NodeJS.Timeout;
    private pollInterval: number;
    private taskHandler: ZB.ZBWorkerTaskHandler;

    constructor(
        gRPCClient: any,
        id: string,
        taskType: string,
        taskHandler: ZB.ZBWorkerTaskHandler,
        options: ZB.ZBWorkerOptions = {},
        idColor: Chalk,
        onConnectionError?: ZB.ConnectionErrorHandler,
    ) {
        if (!taskType) {
            throw (new Error("Missing taskType"));
        }
        if (!taskHandler) {
            throw (new Error("Missing taskHandler"));
        }
        this.taskHandler = taskHandler;
        this.taskType = taskType;
        this.maxActiveJobs = options.maxActiveJobs || 32;
        this.timeout = options.timeout || 1000;
        this.pollInterval = options.pollInterval || 100;
        this.id = id || uuid.v4();
        this.gRPCClient = gRPCClient;
        this.onConnectionErrorHandler = onConnectionError;
        this.defaultLogger = new ZBWorkerLogger({ color: idColor }, { id: this.id, taskType: this.taskType });
        this.work();
    }

    /**
     * Returns a promise that the worker has stopped accepting tasks and
     * has drained all current active tasks. Will reject if you try to call it more than once.
     */
    public close() {
        if (this.closePromise) {
            return this.closePromise;
        }
        this.closePromise = new Promise((resolve) => {
            // this.closing prevents the worker from starting work on any new tasks
            this.closing = true;
            if (this.pollHandle) {
                // Stop polling for jobs
                clearInterval(this.pollHandle);
            }
            // We will resolve the Promise in any case at two seconds over the worker timeout period.
            // This deals with phantom tasks, which will have timed out on the server.
            const closeTimeout = setTimeout(resolve, this.timeout + 2000);
            // If we have no active tasks right now, resolve immediately.
            // There could be a race condition here if we just polled the server and it is about to return jobs.
            // In any case, we do not start working on those jobs, so they will time out on the server.
            if (this.activeJobs <= 0) {
                resolve();
            }
            // When this.activeJobs reaches 0, this will resolve the promise to close. Called in this.drainOne().
            this.closeCallback = () => {
                clearTimeout(closeTimeout);
                this.closed = true;
                resolve();
            };
        });
        return this.closePromise;
    }

    public work = () => {
        this.defaultLogger.log(`Ready for ${this.taskType}...`);
        this.activateJobs();
        this.pollHandle = setInterval(() => this.activateJobs(), this.pollInterval);
    }

    public completeJob(completeJobRequest: ZB.CompleteJobRequest): Promise<void> {
        const withStringifiedPayload = stringifyPayload(completeJobRequest);
        log(withStringifiedPayload);
        return this.gRPCClient.completeJobSync(withStringifiedPayload);
    }

    public onConnectionError(handler: (error: any) => void) {
        this.onConnectionErrorHandler = handler;
    }

    public log(msg: any) {
        this.defaultLogger.log(msg);
    }

    public getNewLogger(options: ZB.ZBWorkerLoggerOptions) {
        return new ZBWorkerLogger(options, { id: this.id, taskType: this.taskType });
    }

    // tslint:disable-next-line:no-console
    private internalLog = (ns: string) => (msg: any) => console.log(`${ns}:`, msg);

    private handleGrpcError = (err: any) => {
        if (!this.errored) {
            if (this.onConnectionErrorHandler) {
                this.onConnectionErrorHandler(err);
                this.errored = true;
            } else {
                this.internalLog(
                    chalk.red(`ERROR: `) +
                    chalk.yellow(`${this.id} - ${this.taskType}`))(
                        chalk.red(err.details));
                this.errored = true;
            }
        }
    }

    private activateJobs() {
        /**
         * It would be good to use a mutex to prevent multiple overlapping polling invocations.
         * However, the stream.on("data") is only called when there are jobs, so it there isn't an obvious (to me)
         * way to release the mutex.
         */
        let stream: any;
        if (this.activeJobs >= this.maxActiveJobs) {
            log(`Polling cancelled - ${this.taskType} has ${this.activeJobs} and a capacity of ${this.maxActiveJobs}.`);
            return;
        }

        const amount = this.maxActiveJobs - this.activeJobs;

        const activateJobsRequest: ZB.ActivateJobsRequest = {
            amount,
            timeout: this.timeout,
            type: this.taskType,
            worker: this.id,
        };

        try {
            stream = this.gRPCClient.activateJobsStream(activateJobsRequest);
        } catch (err) {
            return this.handleGrpcError(err);
        }

        const taskHandler = this.taskHandler;
        stream.on("data", (res: ZB.ActivateJobsResponse) => {
            // If we are closing, don't start working on these jobs. They will have to be timed out by the server.
            if (this.closing) {
                return;
            }
            const parsedPayloads = res.jobs.map(parsePayload);
            this.activeJobs += parsedPayloads.length;
            // Call task handler for each new job
            parsedPayloads.forEach((job: ZB.ActivatedJob) => {
                const customHeaders = JSON.parse(job.customHeaders || "{}");
                /**
                 * Client-side timeout handler - removes jobs from the activeJobs count if timed out,
                 * prevents diminished capacity of this worker due to handler misbehaviour.
                 */
                let taskTimedout = false;
                const taskId = uuid.v4();
                log(`Setting ${this.taskType} task timeout for ${taskId} to ${this.timeout}`);
                const timeoutCancel = setTimeout(() => {
                    taskTimedout = true;
                    this.drainOne();
                    log(`Timed out task ${taskId} for ${this.taskType}`);
                }, this.timeout);

                // Any unhandled exception thrown by the user-supplied code will bubble up and throw here.
                // The task timeout handler above will deal with it.
                try {
                    taskHandler(Object.assign({}, job as any, { customHeaders }), (completedPayload) => {
                        this.completeJob({
                            jobKey: job.key,
                            payload: completedPayload,
                        });
                        clearInterval(timeoutCancel);
                        if (!taskTimedout) {
                            this.drainOne();
                            log(`Completed task ${taskId} for ${this.taskType}`);
                        } else {
                            log(`Completed task ${taskId} for ${this.taskType}, however it had timed out.`);
                        }
                    }, this);
                } catch (e) {
                    // tslint:disable-next-line
                    console.log(e);
                }
            });
        });
        stream.on("error", (err: any) => this.handleGrpcError(err));
    }

    private drainOne() {
        this.activeJobs--;
        // If we are closing and hit zero active jobs, resolve the closing promise.
        if (this.activeJobs <= 0 && this.closing) {
            if (this.closeCallback && !this.closed) {
                this.closeCallback();
            }
        }
    }
}
