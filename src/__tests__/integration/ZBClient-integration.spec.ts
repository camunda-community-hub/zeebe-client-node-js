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
			(payload, complete) => {
				complete(payload)
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
		const wfi = await zbc.createWorkflowInstance(
			res.workflows[0].bpmnProcessId,
			{}
		)
		expect(wfi.bpmnProcessId).toBe('hello-world')
		expect(wfi.workflowInstanceKey).toBeTruthy()
		await closeConnection(zbc)
	})
	it('can service a task', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
		await zbc.createWorkflowInstance(res.workflows[0].bpmnProcessId, {})

		zbc.createWorker('test', 'console-log', async (payload, complete) => {
			complete(payload)
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
			(payload, complete) => {
				complete(payload)
				expect(
					payload.customHeaders.message.indexOf('Workflow') !== -1
				).toBe(true)
				done()
			}
		)
		await zbc.publishStartMessage({
			name: 'MSG-START_JOB',
			payload: {
				testKey: 'OHAI',
			},
			timeToLive: 1000,
		})
		await closeConnection(zbc)
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
			done()
		}
	})
})
