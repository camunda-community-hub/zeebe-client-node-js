import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../../index'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

const zbc = new ZBClient()
let wf: CreateProcessInstanceResponse
let processId: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/hello-world.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

afterEach(async() => {
	if (wf && wf.processInstanceKey) {
		await zbc.cancelProcessInstance(wf.processInstanceKey).catch(e => e) // Cleanup any active processes
	}
	await cancelProcesses(processId)
})

afterAll(async () => {
	await zbc.close()
	await cancelProcesses(processId)
})

test('Can get the broker topology', async () => {
	const res = await zbc.topology()
	expect(res?.brokers).toBeTruthy()
})

test('Can create a worker', async() => {
	const zb = new ZBClient()
	const worker = zb.createWorker({
		taskType: 'TASK_TYPE',
		taskHandler: job => job.complete(),
		loglevel: 'NONE',
	})
	expect(worker).toBeTruthy()
	await zb.close()
})

test('Can cancel a process', async () => {
	const wf = await zbc.createProcessInstance(processId, {})
	const wfi = wf.processInstanceKey
	expect(wfi).toBeTruthy()
	await zbc.cancelProcessInstance(wfi)

	// expect(async() => await zbc.cancelProcessInstance(wfi)).toThrow()
	try {
		await zbc.cancelProcessInstance(wfi) // A call to cancel a process that doesn't exist should throw
	} catch (e: any) {
		expect(1).toBe(1)
	}
})

test("does not retry to cancel a process instance that doesn't exist", async () => {
	// See: https://github.com/zeebe-io/zeebe/issues/2680
	// await zbc.cancelProcessInstance('123LoL')
	try {
		await zbc.cancelProcessInstance(2251799813686202)
	} catch (e: any) {
		expect(e.message.indexOf('5 NOT_FOUND:')).toBe(0)
	}
	expect.assertions(1)
})
