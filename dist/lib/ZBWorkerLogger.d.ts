import { ZBWorkerLoggerOptions } from "./interfaces";
export declare class ZBWorkerLogger {
    level?: string;
    private color;
    private namespace?;
    private taskType;
    private id;
    private enabled;
    constructor({ level, color, namespace }: ZBWorkerLoggerOptions | undefined, { id, taskType }: {
        id: string;
        taskType: string;
    });
    log(message: any): void;
    private getMetadataString;
    private getId;
    private stringifyJSON;
    private getNamespace;
}
