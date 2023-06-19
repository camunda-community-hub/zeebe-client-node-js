// import { readFileSync } from 'fs'
// import { v4 as uuid } from 'uuid'
// // Replace a tasktype in a bpmn model with a unique tasktype
// // This deals with stateful tests
// export function createUniqueTaskType({
// 	bpmnFilePath,
// 	taskTypes,
// 	messages,
// }: {
// 	bpmnFilePath: string
// 	taskTypes: string[]
// 	messages: string[]
// }): {
// 	bpmn: Buffer
// 	taskTypes: { [key: string]: string }
// 	messages: { [key: string]: string }
// 	processId: string
// } {
// 	const bpmn = readFileSync(bpmnFilePath, 'utf8')
// 	const newTaskTypes = taskTypes.map(t => ({ [t]: uuid() }))
// 	const newMessages = messages.map(m => ({ [m]: uuid() }))

// 	const replacedTasks =
// 		newTaskTypes.length > 0
// 			? newTaskTypes.reduce(
// 					(p, c) =>
// 						p
// 							.split(
// 								`<zeebe:taskDefinition type="${
// 									Object.keys(c)[0]
// 								}`
// 							)
// 							.join(
// 								`<zeebe:taskDefinition type="${
// 									c[Object.keys(c)[0]]
// 								}`
// 							),
// 					bpmn
// 			  )
// 			: bpmn

// 	const replacedMessages = newMessages
// 		? newMessages.reduce(
// 				(p, c) => p.split(Object.keys(c)[0]).join(c[Object.keys(c)[0]]),
// 				replacedTasks
// 		  )
// 		: replacedTasks

// 	const processIdPieces = replacedMessages.split('<bpmn:process id="')

// 	const endOfProcessId = processIdPieces[1].indexOf('"')
// 	const secondHalf = processIdPieces[1].substr(endOfProcessId)

// 	const newProcessId = `process-${uuid()}`
// 	const renamedProcess = processIdPieces[0].concat(
// 		'<bpmn:process id="',
// 		newProcessId,
// 		secondHalf
// 	)

// 	const taskTypesMap = newTaskTypes.reduce((p, c) => ({ ...p, ...c }), {})
// 	const messagesMap = newMessages.reduce((p, c) => ({ ...p, ...c }), {})

// 	return {
// 		bpmn: Buffer.from(renamedProcess),
// 		messages: messagesMap,
// 		processId: newProcessId,
// 		taskTypes: taskTypesMap,
// 	}
// }
