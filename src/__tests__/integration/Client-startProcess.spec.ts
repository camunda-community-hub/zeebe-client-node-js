import { cancelProcesses } from '../ lib/cancelProcesses'
import { ZBClient } from '../..'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

let zbc = new ZBClient()
let wf: CreateProcessInstanceResponse
let id: string
let processId: string
let processId2: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/hello-world.bpmn')
	processId = res.processes[0].bpmnProcessId
	processId2 = (await zbc.deployProcess('./src/__tests__/testdata/Client-SkipFirstTask.bpmn')).processes[0].bpmnProcessId
	await cancelProcesses(processId)
	await cancelProcesses(processId2)
})

afterAll(async () => {
	if (id) {
		// console.log(`Canceling process id ${id}`)
		zbc.cancelProcessInstance(id).catch(_ => _)
	}
	await zbc.close() // Makes sure we don't forget to close connection
	await cancelProcesses(processId)
	await cancelProcesses(processId)
})

test('Can start a process', async () => {
	wf = await zbc.createProcessInstance(processId, {})
	await zbc.cancelProcessInstance(wf.processInstanceKey)
	expect(wf.bpmnProcessId).toBe(processId)
	expect(wf.processInstanceKey).toBeTruthy()
})

test('Can start a process at an arbitrary point', done => {
	const random = Math.random()
	zbc.createWorker({
		taskType: "second_service_task",
		taskHandler: job => {
			expect(job.variables.id).toBe(random)
			return job.complete().then(() => done())
		}
	})
	zbc.createProcessInstance({
		bpmnProcessId: 'SkipFirstTask',
		variables: { id: random },
		startInstructions: [{elementId: 'second_service_task'}]
	}).then(res => (id = res.processInstanceKey))
})
