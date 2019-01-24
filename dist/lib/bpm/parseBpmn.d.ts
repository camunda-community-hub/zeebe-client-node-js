/**
 * Reads one or more BPMN files and returns an array of one or more parsed BPMN objects.
 * @param filenames - A single BPMN file path, or array of BPMN file paths.
 */
export declare function parseBpmn(filenames: string | string[]): object;
export declare function getProcessId(bpmnString: string): any;
/**
 * Takes one or more parsed BPMN objects and returns an array of unique task types.
 * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
 */
export declare function getTaskTypes(processes: object[] | object): Promise<string[]>;
/**
 * Takes one or more parsed BPMN objects and returns an array of unique message names.
 * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
 */
export declare function getMessageNames(processes: object[] | object): Promise<string[]>;
/**
 * Generate a TypeScript file containing constants for task types and message names in BPMN files
 * @param filenames - a BPMN file path or array of BPMN file paths
 */
export declare function generateConstantsForBpmnFiles(filenames: string | string[]): Promise<string>;
