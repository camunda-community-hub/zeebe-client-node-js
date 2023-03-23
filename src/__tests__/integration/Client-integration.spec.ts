import { ZBClient } from '../../index'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

let zbc: ZBClient
let wf: CreateProcessInstanceResponse

beforeEach(() => {
	zbc = new ZBClient()
})

afterEach(async() => {
	if (wf && wf.processInstanceKey) {
		await zbc.cancelProcessInstance(wf.processInstanceKey).catch(e => e) // Cleanup any active processes
	}
})

afterAll(async() => {
	await zbc.close()
})

test('Can get the broker topology', async () => {
	const res = await zbc.topology()
	expect(res?.brokers).toBeTruthy()
})

test('Deploys a single process', async () => {
	const { bpmn, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
		messages: [],
		taskTypes: ['console-log-complete'],
	})
	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `single-hello-world-${processId}.bpmn`,
	})

	expect(res.processes.length).toBe(1)
	expect(res.processes[0].bpmnProcessId).toBe(processId)
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
	const { bpmn, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
		messages: [],
		taskTypes: ['console-log'],
	})
	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `cancel-hello-world-${processId}.bpmn`,
	})

	wf = await zbc.createProcessInstance(processId, {})
	const wfi = wf.processInstanceKey
	expect(wfi).toBeTruthy()
	expect(res.processes.length).toBe(1)
	expect(res.processes[0].bpmnProcessId).toBe(processId)
	await zbc.cancelProcessInstance(wfi)

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
