import chalk from "chalk";
import * as uuid from "uuid";
import { parsePayload, stringifyPayload } from "../lib";
import * as ZB from "../lib/interfaces";

export class ZBWorker {
    public gRPCClient: any;
    public activeJobs = 0;
    public taskType: string;
    public maxActiveJobs: number;
    public timeout: number;

    private taskHandler: ZB.taskHandlerFn;
    private id = uuid.v4();
    private pollInterval: number;
    private errored = false;
    private onConnectionErrorHandler?: ZB.ConnectionErrorHandler;
    private acquiringJobs = false;

    constructor(
        gRPCClient: any,
        id: string,
        taskType: string,
        taskHandler: ZB.taskHandlerFn,
        options: ZB.ZBWorkerOptions = {},
        onConnectionError?: ZB.ConnectionErrorHandler,
    ) {
        if (!taskType) {
            throw(new Error("Missing taskType"));
        }
        if (!taskHandler) {
            throw(new Error("Missing taskHandler"));
        }
        this.taskHandler = taskHandler;
        this.taskType = taskType;
        this.maxActiveJobs = options.maxActiveJobs || 32;
        this.timeout = options.timeout || 1000;
        this.pollInterval = options.pollInterval || 100;
        this.id = id || uuid.v4();
        this.gRPCClient = gRPCClient;
        this.onConnectionErrorHandler = onConnectionError;
        this.work();
    }

    public work = () => {
        this.log(chalk.yellow(this.id))(chalk.green(`Ready for `) + chalk.yellow(`${this.taskType}...`));
        this.activateJobs();
        setInterval(() => this.activateJobs(), this.pollInterval);
    }

    public completeJob(completeJobRequest: ZB.CompleteJobRequest): Promise<void> {
        return this.gRPCClient.completeJobSync(stringifyPayload(completeJobRequest));
    }

    public onConnectionError(handler: (error: any) => void) {
        this.onConnectionErrorHandler = handler;
    }

    // tslint:disable-next-line:no-console
    private log = (ns: string) => (msg: any) => console.log(`${ns}:`, msg);

    private handleGrpcError = (err: any) => {
        this.acquiringJobs = false;
        if (!this.errored) {
            if (this.onConnectionErrorHandler) {
                this.onConnectionErrorHandler(err);
                this.errored = true;
            } else {
                this.log(
                    chalk.red(`ERROR: `) +
                    chalk.yellow(`${this.id} - ${this.taskType}`))(
                    chalk.red(err.details));
                this.errored = true;
            }
        }
    }

    private activateJobs() {
        let stream: any;
        // Prevent over capacity
        if (this.acquiringJobs || this.activeJobs >= this.maxActiveJobs) {
            return;
        }
        // Prevent simultaneous in-flight requests
        this.acquiringJobs = true;

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
            this.acquiringJobs = false;
            return this.handleGrpcError(err);
        }

        const taskHandler = this.taskHandler;
        stream.on("data", (res: ZB.ActivateJobsResponse) => {
            const parsedPayloads = res.jobs.map(parsePayload);
            this.activeJobs += parsedPayloads.length;
            // We got jobs and updated the activeJob count - allow further polling
            this.acquiringJobs = false;
            // Call task handler for each new job
            parsedPayloads.forEach((job: ZB.ActivatedJob) => {
                const customHeaders = JSON.parse(job.customHeaders || "{}");
                // Client-side timeout handler - removes jobs from the active count if timed out,
                // prevents diminished capacity due to handler misbehaviour.
                let taskTimedout = false;
                const timeoutCancel = setTimeout(() => {
                    taskTimedout = true;
                    this.activeJobs--;
                }, this.timeout);

                taskHandler(Object.assign({}, job as any, {customHeaders}), (completedPayload) => {
                    this.completeJob({
                        jobKey: job.key,
                        payload: completedPayload,
                    });
                    clearInterval(timeoutCancel);
                    if (!taskTimedout) {
                        this.activeJobs--;
                    }
                }, this);
            });
        });
        stream.on("error", (err: any) => this.handleGrpcError(err));
    }
}
