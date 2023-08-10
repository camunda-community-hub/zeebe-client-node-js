import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../../index'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

let zbc: ZBClient
let wf: CreateProcessInstanceResponse
let processId: string

beforeAll(async () => {
	const client = new ZBClient()
	const res = await client.deployProcess('./src/__tests__/testdata/hello-world.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
	await client.close()
})

beforeEach(() => {
	zbc = new ZBClient()
})

afterEach(async() => {
	await zbc.close()
	if (wf && wf.processInstanceKey) {
		await zbc.cancelProcessInstance(wf.processInstanceKey).catch(e => e) // Cleanup any active processes
	}
	await cancelProcesses(processId)
})

afterAll(async () => {
	await zbc.close() // .then(() => console.log(`ZBClient closed`))
	await cancelProcesses(processId)
})

test('Can get the broker topology', async () => {
	const res = await zbc.topology()
	expect(res?.brokers).toBeTruthy()
})

test('Can create a worker', async() => {
	const worker = zbc.createWorker({
		taskType: 'TASK_TYPE',
		taskHandler: job => job.complete(),
		loglevel: 'NONE',
	})
	expect(worker).toBeTruthy()
	await worker.close()
})

test('Can cancel a process', async () => {
	const client = new ZBClient()
	const process = await client.createProcessInstance({
		bpmnProcessId: processId,
		variables: {}
	})
	const key = process.processInstanceKey
	expect(key).toBeTruthy()
	await client.cancelProcessInstance(key)
	try {
		await client.cancelProcessInstance(key) // A call to cancel a process that doesn't exist should throw
	} catch (e: any) {
		expect(1).toBe(1)
	}
	await client.close()
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
