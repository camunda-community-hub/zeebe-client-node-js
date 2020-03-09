import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

const trace = async result => {
	// tslint:disable-next-line: no-console
	console.log(result)
	return result
}

describe('ZBClient', () => {
	let zbc: ZBClient
	let wf

	beforeEach(async () => {
		zbc = new ZBClient()
	})

	afterEach(async () => {
		try {
			if (wf) {
				zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // Cleanup any active workflows
			}
		} finally {
			await zbc.close() // Makes sure we don't forget to close connection
		}
	})

	it('Can get the broker topology', async () => {
		const res = await zbc.topology()
		expect(res?.brokers).toBeTruthy()
	})

	it('Deploys a single workflow', async () => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res?.workflows?.length).toBe(1)
		expect(res?.workflows?.[0]?.bpmnProcessId).toBe('hello-world')
	})

	it('Can create a worker', () => {
		const worker = zbc.createWorker(
			'test',
			'TASK_TYPE',
			(job, complete) => {
				complete.success(job)
			},
			{ loglevel: 'NONE' }
		)
		expect(worker).toBeTruthy()
	})

	it('Can start a workflow', async () => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res?.workflows?.length).toBe(1)

		wf = await zbc.createWorkflowInstance('hello-world', {})
		await zbc.cancelWorkflowInstance(wf?.workflowInstanceKey)
		expect(wf?.bpmnProcessId).toBe('hello-world')
		expect(wf?.workflowInstanceKey).toBeTruthy()
	})

	it('Can cancel a workflow', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res?.workflows?.length).toBe(1)
		expect(res?.workflows?.[0]?.bpmnProcessId).toBe('hello-world')

		wf = await zbc.createWorkflowInstance('hello-world', {})
		const wfi = wf?.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.cancelWorkflowInstance(wfi)

		try {
			await zbc.cancelWorkflowInstance(wfi) // A call to cancel a workflow that doesn't exist should throw
		} catch (e) {
			done()
		}
	})

	it("does not retry to cancel a workflow instance that doesn't exist", async () => {
		expect.assertions(1)
		// See: https://github.com/zeebe-io/zeebe/issues/2680
		// await zbc.cancelWorkflowInstance('123LoL')
		try {
			await zbc.cancelWorkflowInstance(2251799813686202)
		} catch (e) {
			expect(e.message.indexOf('5 NOT_FOUND:')).toBe(0)
		}
	})
})
