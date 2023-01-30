import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

let zbc: ZBClient
let wf: CreateProcessInstanceResponse

beforeEach(async () => {
	zbc = new ZBClient()
})

afterEach(async () => {
	await zbc.close() // Makes sure we don't forget to close connection
})

test('Can start a process', async () => {
	const { bpmn, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
		messages: [],
		taskTypes: ['console-log'],
	})
	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `start-hello-world-${processId}.bpmn`,
	})
	expect(res.processes.length).toBe(1)

	wf = await zbc.createProcessInstance(processId, {})
	await zbc.cancelProcessInstance(wf.processInstanceKey)
	expect(wf.bpmnProcessId).toBe(processId)
	expect(wf.processInstanceKey).toBeTruthy()
})

test('Can start a process at an arbitrary point', done => {
	const res = zbc.deployProcess('./src/__tests__/testdata/Client-SkipFirstTask.bpmn')
	const id = Math.random()
	zbc.createWorker({
		taskType: "second_service_task",
		taskHandler: job => {
			expect(job.variables.id).toBe(id)
			return job.complete().then(() => done())
		}
	})
	zbc.createProcessInstance('SkipFirstTask', { id })
})
