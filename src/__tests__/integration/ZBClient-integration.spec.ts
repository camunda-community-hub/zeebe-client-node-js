import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient('0.0.0.0:26500')
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Can get the broker topology', async () => {
		const res = await zbc.topology()
		expect(res.brokers).toBeTruthy()
	})

	it('Deploys a single workflow', async () => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
	})

	it('Does not redeploy a workflow when that workflow is already deployed', async () => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(false)
	})

	it('Can create a worker', () => {
		const worker = zbc.createWorker(
			'test',
			'TASK_TYPE',
			(job, complete) => {
				complete(job)
			}
		)
		expect(worker).toBeTruthy()
	})

	it('Can start a workflow', async () => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)

		const workflowInstance = await zbc.createWorkflowInstance(
			'hello-world',
			{}
		)
		expect(workflowInstance.bpmnProcessId).toBe('hello-world')
		expect(workflowInstance.workflowInstanceKey).toBeTruthy()
	})

	it('Can cancel a workflow', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')

		const wf = await zbc.createWorkflowInstance('hello-world', {})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.cancelWorkflowInstance(wfi)

		try {
			await zbc.cancelWorkflowInstance(wfi) // A call to cancel a workflow that doesn't exist should throw
		} catch (e) {
			done()
		}
	})

	it('Correctly branches on variables', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/conditional-pathway.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')

		const wf = await zbc.createWorkflowInstance('condition-test', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.createWorker('test2', 'wait', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			complete(job)
		})

		await zbc.createWorker('test2', 'pathA', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(true)
			complete(job)
			done()
		})
	})

	it('Can update workflow variables', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/conditional-pathway.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')

		const wf = await zbc.createWorkflowInstance('condition-test', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		await zbc.createWorker('test2', 'wait', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			complete(job)
		})

		await zbc.createWorker('test2', 'pathB', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(false)
			complete(job.variables)
			done()
		})
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
