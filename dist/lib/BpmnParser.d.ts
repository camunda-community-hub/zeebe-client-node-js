export declare class BpmnParser {
    /**
     * Read BPMN files and return an array of one or more parsed BPMN objects.
     * @param filenames - A single BPMN file path, or array of BPMN file paths.
     */
    static parseBpmn(filenames: string | string[]): object;
    static getProcessId(bpmnString: string): any;
    /**
     * Generate TypeScript constants for task types and message names in BPMN files
     * @param filenames - a BPMN file path or array of BPMN file paths
     */
    static generateConstantsForBpmnFiles(filenames: string | string[]): Promise<string>;
    /**
     * Take one or more parsed BPMN objects and return an array of unique task types.
     * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
     */
    static getTaskTypes(processes: object[] | object): Promise<string[]>;
    /**
     * Take one or more parsed BPMN objects and return an array of unique message names.
     * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
     */
    static getMessageNames(processes: object[] | object): Promise<string[]>;
    private static parserOptions;
    private static mergeDedupeAndSort;
    /**
     * Return an array of task types.
     * @param bpmnObject - A parsed Bpmn object.
     */
    private static scanBpmnObjectForTasks;
    /**
     * Return an array of message names.
     * @param bpmnObject - A parsed Bpmn object.
     */
    private static scanBpmnObjectForMessages;
}
