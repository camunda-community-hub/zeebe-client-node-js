import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('ZBWorker', () => {
	let zbc: ZBClient
	let wf

	beforeEach(async () => {
		zbc = new ZBClient(gatewayAddress)
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
				complete.success(job.variables)
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
			'test',
			'console-log',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				complete.success(job.variables)
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
			'test2',
			'wait',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				complete.success(job)
			},
			{ loglevel: 'NONE' }
		)

		zbc.createWorker(
			'test2',
			'pathB',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				complete.success(job.variables)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})
})
