import { v4 as uuid } from 'uuid'
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
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
	})

	it('Does not redeploy a workflow when that workflow is already deployed', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(false)
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

		const workflowInstance = await zbc.createWorkflowInstance(
			'hello-world',
			{}
		)
		expect(workflowInstance.bpmnProcessId).toBe('hello-world')
		expect(workflowInstance.workflowInstanceKey).toBeTruthy()
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

	it('Causes a retry with complete.failure()', async done => {
		let attempts = 0
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
			expect(job.workflowInstanceKey).toBe(wfi)
			attempts++
			// Succeed on the third attempt
			if (attempts === 3) {
				return complete()
			}
			complete.failure('Triggering a retry')
			if (attempts === 2) {
				expect(attempts).toBe(2)
				done()
			}
		})
	})

	it('Can raise an Operate incident with complete.failure()', async done => {
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
			expect(job.workflowInstanceKey).toBe(wfi)
			complete.success(job)
		})

		await zbc.createWorker('test2', 'pathB', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(false)
			complete.failure('Raise an incident in Operate', 0)
			// Manually verify that an incident has been raised
			done()
		})
	})

	it('does not retry the deployment of a broken BPMN file', async () => {
		expect.assertions(1)
		try {
			await zbc.deployWorkflow('./test/broken-bpmn.bpmn')
		} catch (e) {
			expect(e.message.indexOf('3 INVALID_ARGUMENT:')).toBe(0)
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
