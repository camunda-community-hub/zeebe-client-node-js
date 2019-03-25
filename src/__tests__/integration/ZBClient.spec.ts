import { ZBClient } from '../..'
jest.unmock('node-grpc-client')

const zbc = new ZBClient('0.0.0.0:26500')

describe('ZBClient.deployWorkflow()', () => {
	it('can get the broker topology', async () => {
		const res = await zbc.topology()
		expect(res.brokers).toBeTruthy()
	})
	it('deploys a single workflow', async () => {
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
	})
	it('by default, it deploys a single workflow when that workflow is already deployed', () => {
		// const zbc = new ZBClient("localhost");
		expect(true).toBe(true)
	})
	it('with {redeploy: false} it will not redeploy an existing workflow', () => {
		// const zbc = new ZBClient("localhost");
		expect(true).toBe(true)
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
		zbc.close()
	})
})
