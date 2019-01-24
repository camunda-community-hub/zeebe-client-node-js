"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser = require("fast-xml-parser");
const fs = require("fs");
const path = require("path");
const parserOptions = {
    allowBooleanAttributes: false,
    attrNodeName: "attr",
    attributeNamePrefix: "@_",
    cdataPositionChar: "\\c",
    cdataTagName: "__cdata",
    ignoreAttributes: false,
    ignoreNameSpace: false,
    localeRange: "",
    parseAttributeValue: false,
    parseNodeValue: true,
    parseTrueNumberOnly: false,
    textNodeName: "#text",
    trimValues: true,
};
/**
 * Reads one or more BPMN files and returns an array of one or more parsed BPMN objects.
 * @param filenames - A single BPMN file path, or array of BPMN file paths.
 */
function parseBpmn(filenames) {
    if (typeof filenames === "string") {
        filenames = [filenames];
    }
    return filenames.map((filename) => {
        const xmlData = fs.readFileSync(filename).toString();
        if (parser.validate(xmlData)) {
            return parser.parse(xmlData, parserOptions);
        }
        return {};
    });
}
exports.parseBpmn = parseBpmn;
// @ TODO: examine Camunda's parse BPMN code
// https://github.com/camunda/camunda-bpmn-model/tree/master/src/main/java/org/camunda/bpm/model/bpmn
function getProcessId(bpmnString) {
    const jsonObj = parser.parse(bpmnString, parserOptions);
    if (jsonObj) {
        if (jsonObj["bpmn:definitions"]) {
            if (jsonObj["bpmn:definitions"]["bpmn:process"]) {
                const attr = jsonObj["bpmn:definitions"]["bpmn:process"].attr;
                return attr ? attr["@_id"] : undefined;
            }
        }
    }
    return undefined;
}
exports.getProcessId = getProcessId;
function mergeDedupeAndSort(arr) {
    return [...new Set(([].concat(...arr)).sort())];
}
/**
 * Takes one or more parsed BPMN objects and returns an array of unique task types.
 * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
 */
async function getTaskTypes(processes) {
    const processArray = Array.isArray(processes) ? processes : [processes];
    return mergeDedupeAndSort(await Promise.all(processArray.map(scanBpmnObjectForTasks)));
}
exports.getTaskTypes = getTaskTypes;
/**
 * Takes one or more parsed BPMN objects and returns an array of unique message names.
 * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
 */
async function getMessageNames(processes) {
    const processArray = Array.isArray(processes) ? processes : [processes];
    return mergeDedupeAndSort(await Promise.all(processArray.map(scanBpmnObjectForMessages)));
}
exports.getMessageNames = getMessageNames;
/**
 * Returns an array of task types.
 * @param bpmnObject - A parsed Bpmn object.
 */
async function scanBpmnObjectForTasks(bpmnObject) {
    let taskTypes = []; // mutated in the recursive function
    await scanRecursively(bpmnObject);
    return [...new Set(taskTypes.sort())];
    async function scanRecursively(obj) {
        let k;
        if (obj instanceof Object) {
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    if (k === "bpmn:serviceTask") {
                        const tasks = Array.isArray(obj[k]) ? obj[k] : [obj[k]];
                        taskTypes = taskTypes.concat(tasks.map((t) => t["bpmn:extensionElements"]["zeebe:taskDefinition"].attr["@_type"]));
                    }
                    else {
                        // recursive call to scan property
                        await scanRecursively(obj[k]);
                    }
                }
            }
        }
        else {
            // not an Object so obj[k] here is a value
        }
    }
}
/**
 * Returns an array of message names.
 * @param bpmnObject - A parsed Bpmn object.
 */
async function scanBpmnObjectForMessages(bpmnObject) {
    let messageNames = []; // mutated in the recursive function
    await scanRecursively(bpmnObject);
    return [...new Set(messageNames.sort())];
    async function scanRecursively(obj) {
        let k;
        if (obj instanceof Object) {
            for (k in obj) {
                if (obj.hasOwnProperty(k)) {
                    if (k === "bpmn:message") {
                        const messages = Array.isArray(obj[k]) ? obj[k] : [obj[k]];
                        messageNames = messageNames.concat(messages.map((m) => m.attr["@_name"]));
                    }
                    else {
                        // recursive call to scan property
                        await scanRecursively(obj[k]);
                    }
                }
            }
        }
        else {
            // not an Object so obj[k] here is a value
        }
    }
}
/**
 * Generate a TypeScript file containing constants for task types and message names in BPMN files
 * @param filenames - a BPMN file path or array of BPMN file paths
 */
async function generateConstantsForBpmnFiles(filenames) {
    if (typeof filenames === "string") {
        filenames = [filenames];
    }
    const parsed = parseBpmn(filenames);
    const taskTypes = await getTaskTypes(parsed);
    const messageNames = await getMessageNames(parsed);
    const files = filenames.map((f) => path.basename(f));
    return `
// Autogenerated constants for ${files}

export const TaskType = ${JSON.stringify(taskTypes, null, 4)};

export const MessageName = ${JSON.stringify(messageNames, null, 4)};

`;
}
exports.generateConstantsForBpmnFiles = generateConstantsForBpmnFiles;
//# sourceMappingURL=parseBpmn.js.map