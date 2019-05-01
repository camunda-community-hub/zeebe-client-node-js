import { v4 as uuid } from 'uuid'
import { ZBClient } from '../..'
jest.unmock('node-grpc-client')

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient.deployWorkflow()', () => {
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
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
	})

	it('By default, it deploys a single workflow when that workflow is already deployed', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
	})

	it('With {redeploy: false} it will not redeploy an existing workflow', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn', {
			redeploy: false,
		})
		expect(res.key).toBe(-1)
	})

	it('Lists workflows', async () => {
		const res = await zbc.listWorkflows()
		expect(res.workflows).toBeTruthy()
	})

	it('Can create a worker', async () => {
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
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)

		const workflowInstance = await zbc.createWorkflowInstance(
			'hello-world',
			{}
		)
		expect(workflowInstance.bpmnProcessId).toBe('hello-world')
		expect(workflowInstance.workflowInstanceKey).toBeTruthy()
	})

	it('Can service a task', async done => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)

		const wf = await zbc.createWorkflowInstance('hello-world', {})
		zbc.createWorker('test', 'console-log', async (job, complete) => {
			expect(job.jobHeaders.workflowInstanceKey).toBe(
				wf.workflowInstanceKey
			)
			complete(job.variables)
			done()
		})
	})

	it('Can start a workflow with a message', async done => {
		const deploy = await zbc.deployWorkflow(
			'./src/__tests__/testdata/msg-start.bpmn'
		)
		expect(deploy.key).toBeTruthy()

		const randomId = uuid()

		await zbc.publishStartMessage({
			name: 'MSG-START_JOB',
			timeToLive: 1000,
			variables: {
				testKey: randomId,
			},
		})

		await zbc.createWorker(
			'test2',
			'console-log-msg',
			async (job, complete) => {
				complete(job.variables)
				expect(
					job.customHeaders.message.indexOf('Workflow') !== -1
				).toBe(true)
				expect(job.variables.testKey).toBe(randomId) // Makes sure the worker isn't responding to another message
				done()
			}
		)
	})

	it('Can cancel a workflow', async done => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
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
		const res = await zbc.deployWorkflow('./test/conditional-pathway.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')

		const wf = await zbc.createWorkflowInstance('condition-test', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.createWorker('test2', 'wait', async (job, complete) => {
			expect(job.jobHeaders.workflowInstanceKey).toBe(wfi)
			complete(job)
		})

		await zbc.createWorker('test2', 'pathA', async (job, complete) => {
			expect(job.jobHeaders.workflowInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(true)
			complete(job)
			done()
		})
	})

	it('Can update workflow variables', async done => {
		const res = await zbc.deployWorkflow('./test/conditional-pathway.bpmn')
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
			expect(job.jobHeaders.workflowInstanceKey).toBe(wfi)
			complete(job)
		})

		await zbc.createWorker('test2', 'pathB', async (job, complete) => {
			expect(job.jobHeaders.workflowInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(false)
			complete(job.variables)
			done()
		})
	})
})
