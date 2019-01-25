"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ZBWorkerLogger {
    constructor({ level, color, namespace } = {}, { id, taskType }) {
        this.enabled = true;
        if (color) {
            this.color = color;
        }
        else {
            this.color = ((m) => m);
        }
        this.taskType = taskType;
        this.id = id;
        if (Array.isArray(namespace)) {
            namespace = namespace.join(" ");
        }
        this.namespace = namespace;
        this.level = level;
    }
    log(message) {
        if (!this.enabled) {
            return;
        }
        // tslint:disable-next-line
        console.log(this.color(this.getMetadataString() + " > " + this.stringifyJSON(message)));
    }
    getMetadataString() {
        return "[ " + this.getId() + this.getNamespace() + " ]";
    }
    getId() {
        return `${this.taskType} ${this.id}`;
    }
    stringifyJSON(message) {
        let parsedMessage = message;
        if (typeof message === "object") {
            try {
                parsedMessage = JSON.stringify(message);
            }
            catch (e) {
                parsedMessage = message;
            }
        }
        return parsedMessage;
    }
    getNamespace() {
        return this.namespace ? ` ${this.namespace}` : "";
    }
}
exports.ZBWorkerLogger = ZBWorkerLogger;
//# sourceMappingURL=ZBWorkerLogger.js.map