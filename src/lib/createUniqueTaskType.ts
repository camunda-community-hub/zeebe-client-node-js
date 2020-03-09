import { readFileSync } from 'fs'
import { v4 as uuid } from 'uuid'
// Replace a tasktype in a bpmn model with a unique tasktype
// This deals with stateful tests
export function createUniqueTaskType({
	bpmnFilePath,
	taskTypes,
	processIdPrefix,
}: {
	bpmnFilePath: string
	taskTypes: string[]
	processIdPrefix: string
}): {
	bpmn: Buffer
	taskTypes: { [key: string]: string }
} {
	const bpmn = readFileSync(bpmnFilePath, 'utf-8')
	const newTaskTypes = taskTypes.map(t => ({ [t]: uuid() }))

	const modifiedBpmn = newTaskTypes.reduce(
		(p, c) =>
			p
				.split(`<zeebe:taskDefinition type="${Object.keys(c)[0]}`)
				.join(`<zeebe:taskDefinition type="${c[Object.keys(c)[0]]}`),
		bpmn
	)

	const renamedProcess = modifiedBpmn
		.split('<bpmn:process id="')
		.join(`<bpmn:process id="${processIdPrefix}`)

	const taskTypesMap = newTaskTypes.reduce((p, c) => ({ ...p, ...c }), {})
	return {
		bpmn: Buffer.from(renamedProcess),
		taskTypes: taskTypesMap,
	}
}
