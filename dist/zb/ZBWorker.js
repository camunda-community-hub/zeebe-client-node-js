"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = require("chalk");
const uuid = require("uuid");
const lib_1 = require("../lib");
class ZBWorker {
    constructor(gRPCClient, id, taskType, taskHandler, options = {}, onConnectionError) {
        this.activeJobs = 0;
        this.id = uuid.v4();
        this.errored = false;
        this.acquiringJobs = false;
        this.work = () => {
            this.log(chalk_1.default.yellow(this.id))(chalk_1.default.green(`Ready for `) + chalk_1.default.yellow(`${this.taskType}...`));
            this.activateJobs();
            setInterval(() => this.activateJobs(), this.pollInterval);
        };
        // tslint:disable-next-line:no-console
        this.log = (ns) => (msg) => console.log(`${ns}:`, msg);
        this.handleGrpcError = (err) => {
            this.acquiringJobs = false;
            if (!this.errored) {
                if (this.onConnectionErrorHandler) {
                    this.onConnectionErrorHandler(err);
                    this.errored = true;
                }
                else {
                    this.log(chalk_1.default.red(`ERROR: `) +
                        chalk_1.default.yellow(`${this.id} - ${this.taskType}`))(chalk_1.default.red(err.details));
                    this.errored = true;
                }
            }
        };
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
        this.work();
    }
    completeJob(completeJobRequest) {
        return this.gRPCClient.completeJobSync(lib_1.stringifyPayload(completeJobRequest));
    }
    onConnectionError(handler) {
        this.onConnectionErrorHandler = handler;
    }
    activateJobs() {
        let stream;
        // Prevent over capacity
        if (this.acquiringJobs || this.activeJobs >= this.maxActiveJobs) {
            return;
        }
        // Prevent simultaneous in-flight requests
        this.acquiringJobs = true;
        const amount = this.maxActiveJobs - this.activeJobs;
        const activateJobsRequest = {
            amount,
            timeout: this.timeout,
            type: this.taskType,
            worker: this.id,
        };
        try {
            stream = this.gRPCClient.activateJobsStream(activateJobsRequest);
        }
        catch (err) {
            this.acquiringJobs = false;
            return this.handleGrpcError(err);
        }
        const taskHandler = this.taskHandler;
        stream.on("data", (res) => {
            const parsedPayloads = res.jobs.map(lib_1.parsePayload);
            this.activeJobs += parsedPayloads.length;
            // We got jobs and updated the activeJob count - allow further polling
            this.acquiringJobs = false;
            // Call task handler for each new job
            parsedPayloads.forEach((job) => {
                const customHeaders = JSON.parse(job.customHeaders || "{}");
                // Client-side timeout handler - removes jobs from the active count if timed out,
                // prevents diminished capacity due to handler misbehaviour.
                let taskTimedout = false;
                const timeoutCancel = setTimeout(() => {
                    taskTimedout = true;
                    this.activeJobs--;
                }, this.timeout);
                taskHandler(Object.assign({}, job, { customHeaders }), (completedPayload) => {
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
        stream.on("error", (err) => this.handleGrpcError(err));
    }
}
exports.ZBWorker = ZBWorker;
//# sourceMappingURL=ZBWorker.js.map