import { ZBClient } from '../..'
jest.unmock('node-grpc-client')

const zbc = new ZBClient('0.0.0.0:26500')

afterAll(() => {
	zbc.close()
})

describe('ZBClient.deployWorkflow()', () => {
	it('can get the broker topology', async () => {
		const res = await zbc.topology()
		expect(res.brokers).toBeTruthy()
	})
	it('deploys a single workflow', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
	})
	it('by default, it deploys a single workflow when that workflow is already deployed', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
	})
	it('with {redeploy: false} it will not redeploy an existing workflow', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn', {
			redeploy: false,
		})
		expect(res.key).toBe(-1)
	})

	it('lists workflows', async () => {
		const res = await zbc.listWorkflows()
		expect(res.workflows).toBeTruthy()
	})

	it('can create a worker', () => {
		const worker = zbc.createWorker(
			'test',
			'TASK_TYPE',
			(payload, complete) => {
				complete(payload)
			}
		)
		expect(worker).toBeTruthy()
	})
	it('can start a workflow', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].version > 1).toBe(true)
		const wfi = await zbc.createWorkflowInstance(
			res.workflows[0].bpmnProcessId,
			{}
		)
		expect(wfi.bpmnProcessId).toBe('hello-world')
		expect(wfi.workflowInstanceKey).toBeTruthy()
	})
	it('can service a task', done => {
		zbc.createWorker('test', 'console-log', (payload, complete) => {
			complete(payload)
			done()
		})
	})
	it('can start a workflow with a message', async done => {
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
	})
})
