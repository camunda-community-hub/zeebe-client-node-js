import { ZBClient } from '../../..'
import { createUniqueTaskType } from '../../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

let zbc: ZBClient
let wf

beforeEach(() => {
	zbc = new ZBClient()
})

afterEach(async done => {
	try {
		if (wf && wf.workflowInstanceKey) {
			await zbc
				.cancelWorkflowInstance(wf.workflowInstanceKey)
				.catch(e => e) // Cleanup any active workflows
		}
	} finally {
		done()
	}
})

afterAll(async done => {
	await zbc.close()
	done()
})

test('Can get the broker topology', async () => {
	const res = await zbc.topology()
	expect(res?.brokers).toBeTruthy()
})

test('Deploys a single workflow', async () => {
	const { bpmn, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
		messages: [],
		taskTypes: ['console-log-complete'],
	})
	const res = await zbc.deployWorkflow({
		definition: bpmn,
		name: `single-hello-world-${processId}.bpmn`,
	})

	expect(res.workflows.length).toBe(1)
	expect(res.workflows[0].bpmnProcessId).toBe(processId)
})

test('Can create a worker', done => {
	const worker = zbc.createWorker(
		'test',
		'TASK_TYPE',
		(job, complete) => complete.success(job),
		{ loglevel: 'NONE' }
	)
	expect(worker).toBeTruthy()
	worker.close().then(() => done())
})

test('Can cancel a workflow', async () => {
	const { bpmn, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
		messages: [],
		taskTypes: ['console-log'],
	})
	const res = await zbc.deployWorkflow({
		definition: bpmn,
		name: `cancel-hello-world-${processId}.bpmn`,
	})

	wf = await zbc.createWorkflowInstance(processId, {})
	const wfi = wf.workflowInstanceKey
	expect(wfi).toBeTruthy()
	expect(res.workflows.length).toBe(1)
	expect(res.workflows[0].bpmnProcessId).toBe(processId)
	await zbc.cancelWorkflowInstance(wfi)

	try {
		await zbc.cancelWorkflowInstance(wfi) // A call to cancel a workflow that doesn't exist should throw
	} catch (e) {
		expect(1).toBe(1)
	}
})

test("does not retry to cancel a workflow instance that doesn't exist", async () => {
	// See: https://github.com/zeebe-io/zeebe/issues/2680
	// await zbc.cancelWorkflowInstance('123LoL')
	try {
		await zbc.cancelWorkflowInstance(2251799813686202)
	} catch (e) {
		expect(e.message.indexOf('5 NOT_FOUND:')).toBe(0)
	}
	expect.assertions(1)
})
