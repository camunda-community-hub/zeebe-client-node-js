"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = require("chalk");
const debug = require("debug");
const uuid = require("uuid");
const lib_1 = require("../lib");
const ZBWorkerLogger_1 = require("../lib/ZBWorkerLogger");
// tslint:disable-next-line
require("console-stamp")(console, "[HH:MM:ss.l]");
const log = debug("zeebe-node:worker");
class ZBWorker {
    constructor(gRPCClient, id, taskType, taskHandler, options = {}, idColor, onConnectionError) {
        this.activeJobs = 0;
        this.id = uuid.v4();
        this.errored = false;
        this.work = () => {
            this.defaultLogger.log(`Ready for ${this.taskType}...`);
            this.activateJobs();
            setInterval(() => this.activateJobs(), this.pollInterval);
        };
        // tslint:disable-next-line:no-console
        this.internalLog = (ns) => (msg) => console.log(`${ns}:`, msg);
        this.handleGrpcError = (err) => {
            if (!this.errored) {
                if (this.onConnectionErrorHandler) {
                    this.onConnectionErrorHandler(err);
                    this.errored = true;
                }
                else {
                    this.internalLog(chalk_1.default.red(`ERROR: `) +
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
        this.defaultLogger = new ZBWorkerLogger_1.ZBWorkerLogger({ color: idColor }, { id: this.id, taskType: this.taskType });
        this.work();
    }
    completeJob(completeJobRequest) {
        const withStringifiedPayload = lib_1.stringifyPayload(completeJobRequest);
        log(withStringifiedPayload);
        return this.gRPCClient.completeJobSync(withStringifiedPayload);
    }
    onConnectionError(handler) {
        this.onConnectionErrorHandler = handler;
    }
    log(msg) {
        this.defaultLogger.log(msg);
    }
    getNewLogger(options) {
        return new ZBWorkerLogger_1.ZBWorkerLogger(options, { id: this.id, taskType: this.taskType });
    }
    activateJobs() {
        /**
         * It would be good to use a mutex to prevent multiple overlapping polling invocations.
         * However, the stream.on("data") is only called when there are jobs, so it there isn't an obvious (to me)
         * way to release the mutex.
         */
        let stream;
        if (this.activeJobs >= this.maxActiveJobs) {
            log(`Polling cancelled - ${this.taskType} has ${this.activeJobs} and a capacity of ${this.maxActiveJobs}.`);
            return;
        }
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
            return this.handleGrpcError(err);
        }
        const taskHandler = this.taskHandler;
        stream.on("data", (res) => {
            const parsedPayloads = res.jobs.map(lib_1.parsePayload);
            this.activeJobs += parsedPayloads.length;
            // Call task handler for each new job
            parsedPayloads.forEach((job) => {
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
                    this.activeJobs--;
                    log(`Timed out task ${taskId} for ${this.taskType}`);
                }, this.timeout);
                taskHandler(Object.assign({}, job, { customHeaders }), (completedPayload) => {
                    this.completeJob({
                        jobKey: job.key,
                        payload: completedPayload,
                    });
                    clearInterval(timeoutCancel);
                    if (!taskTimedout) {
                        this.activeJobs--;
                        log(`Completed task ${taskId} for ${this.taskType}`);
                    }
                    else {
                        log(`Completed task ${taskId} for ${this.taskType}, however it had timed out.`);
                    }
                }, this);
            });
        });
        stream.on("error", (err) => this.handleGrpcError(err));
    }
}
exports.ZBWorker = ZBWorker;
//# sourceMappingURL=ZBWorker.js.map