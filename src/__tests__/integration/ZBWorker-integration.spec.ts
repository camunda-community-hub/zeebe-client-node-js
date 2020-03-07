import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
describe('ZBWorker', () => {
	let zbc: ZBClient
	let wf

	beforeEach(async () => {
		zbc = new ZBClient()
	})

	afterEach(async () => {
		try {
			await zbc.cancelWorkflowInstance(wf.workflowInstanceKey)
		} finally {
			await zbc.close() // Makes sure we don't forget to close connection
		}
	})

	it('Can service a task', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)

		wf = await zbc.createWorkflowInstance('hello-world', {})
		zbc.createWorker(
			'test',
			'console-log',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				await complete.success(job.variables)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})

	it('Can service a task with complete.success', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		wf = await zbc.createWorkflowInstance('hello-world', {})
		zbc.createWorker(
			'console-log',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				await complete.success(job.variables)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})

	it('Can update workflow variables with complete.success()', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/conditional-pathway.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')

		wf = await zbc.createWorkflowInstance('condition-test', {
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

		zbc.createWorker(
			'wait',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				await complete.success(job)
			},
			{ loglevel: 'NONE' }
		)

		zbc.createWorker(
			'pathB',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				await complete.success(job.variables)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})
})
