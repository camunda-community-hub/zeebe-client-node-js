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
        this.work = () => {
            this.log(chalk_1.default.yellow(this.id))(chalk_1.default.green(`Ready for `) + chalk_1.default.yellow(`${this.taskType}...`));
            this.activateJobs();
            setInterval(() => this.activateJobs(), this.pollInterval);
        };
        // tslint:disable-next-line:no-console
        this.log = (ns) => (msg) => console.log(`${ns}:`, msg);
        this.handleGrpcError = (err) => {
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
        this.options = options;
        this.id = id || uuid.v4();
        this.gRPCClient = gRPCClient;
        this.pollInterval = options.pollInterval || 100;
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
        const capacity = this.options.capacity || 32;
        const timeout = this.options.timeout || 1000;
        const activateJobsRequest = {
            amount: capacity,
            timeout,
            type: this.taskType,
            worker: this.id,
        };
        let stream;
        try {
            stream = this.gRPCClient.activateJobsStream(activateJobsRequest);
        }
        catch (err) {
            return this.handleGrpcError(err);
        }
        const taskHandler = this.taskHandler;
        stream.on("data", (res) => {
            const parsedPayloads = res.jobs.map(lib_1.parsePayload);
            // Call task handler for each new job
            parsedPayloads.forEach((job) => {
                this.activeJobs++;
                const customHeaders = JSON.parse(job.customHeaders || "{}");
                taskHandler(Object.assign({}, job, { customHeaders }), (completedPayload) => {
                    this.completeJob({
                        jobKey: job.key,
                        payload: completedPayload,
                    });
                    this.activeJobs--;
                }, this);
            });
        });
        stream.on("error", (err) => this.handleGrpcError(err));
    }
}
exports.ZBWorker = ZBWorker;
//# sourceMappingURL=worker.js.map