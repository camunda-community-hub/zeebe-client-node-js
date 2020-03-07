import { readFileSync } from 'fs'
import { v4 as uuid } from 'uuid'
// Replace a tasktype in a bpmn model with a unique tasktype
// This deals with stateful tests
export function createUniqueTaskType({
	bpmnFilePath,
	taskType,
}: {
	bpmnFilePath: string
	taskType: string
}) {
	const bpmn = readFileSync(bpmnFilePath, 'utf-8')
	const newTaskType = uuid()
	const modifiedBpmn = bpmn.split(taskType).join(newTaskType)

	return {
		bpmn: Buffer.from(modifiedBpmn),
		taskType: newTaskType,
	}
}
