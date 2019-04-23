import { ZBClient } from '../..'
jest.unmock('node-grpc-client')

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

function closeConnection(zbc: ZBClient) {
	return new Promise(resolve => {
		setTimeout(() => {
			zbc.close()
			resolve()
		}, 1000)
	})
}
describe('ZBClient.deployWorkflow()', () => {
	it('can get the broker topology', async () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.topology()
		expect(res.brokers).toBeTruthy()
		await closeConnection(zbc)
	})
	it('deploys a single workflow', async () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
		await closeConnection(zbc)
	})
	it('by default, it deploys a single workflow when that workflow is already deployed', async () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
		await closeConnection(zbc)
	})
	it('with {redeploy: false} it will not redeploy an existing workflow', async () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn', {
			redeploy: false,
		})
		expect(res.key).toBe(-1)
		await closeConnection(zbc)
	})

	it('lists workflows', async () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.listWorkflows()
		expect(res.workflows).toBeTruthy()
		await closeConnection(zbc)
	})

	it('can create a worker', () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const worker = zbc.createWorker(
			'test',
			'TASK_TYPE',
			(job, complete) => {
				complete(job)
			}
		)
		expect(worker).toBeTruthy()
		zbc.close()
	})
	it('can start a workflow', async () => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
		const wfi = await zbc.createWorkflowInstance('hello-world', {})
		expect(wfi.bpmnProcessId).toBe('hello-world')
		expect(wfi.workflowInstanceKey).toBeTruthy()
		await closeConnection(zbc)
	})
	it('can service a task', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
		await zbc.createWorkflowInstance('hello-world', {})
		zbc.createWorker('test', 'console-log', async (job, complete) => {
			complete(job.variables)
			await closeConnection(zbc)
			done()
		})
	})
	it('can start a workflow with a message', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const deploy = await zbc.deployWorkflow(
			'./src/__tests__/testdata/msg-start.bpmn'
		)
		expect(deploy.key).toBeTruthy()
		await zbc.createWorker(
			'test2',
			'console-log-msg',
			async (job, complete) => {
				complete(job.variables)
				expect(
					job.customHeaders.message.indexOf('Workflow') !== -1
				).toBe(true)
				await closeConnection(zbc)
				done()
			}
		)
		await zbc.publishStartMessage({
			name: 'MSG-START_JOB',
			timeToLive: 1000,
			variables: {
				testKey: 'OHAI',
			},
		})
	})
	it('can cancel a workflow', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
		const wf = await zbc.createWorkflowInstance('hello-world', {})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()
		await zbc.cancelWorkflowInstance(wfi)
		try {
			await zbc.cancelWorkflowInstance(wfi) // a call to cancel a workflow that doesn't exist should throw
		} catch (e) {
			await closeConnection(zbc)
			done()
		}
	})

	it('correctly branches on variables', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/conditional-pathway.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')
		const wf = await zbc.createWorkflowInstance('condition-test', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()
		await zbc.createWorker('test2', 'pathA', async (job, complete) => {
			complete(job)
			expect(job.variables.conditionVariable).toBe(true)
			await closeConnection(zbc)
			done()
		})
	})

	it('can update workflow variables', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')

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
		await zbc.createWorker('test2', 'pathA', async (job, complete) => {
			complete(job)
			expect(job.variables.conditionVariable).toBe(false)
			await closeConnection(zbc)
			done()
		})
	})
})
