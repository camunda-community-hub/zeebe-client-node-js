import { GenericContainer } from '@sitapati/testcontainers'
import { ZBClient } from '../..'
// import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(60000)
describe('Worker disconnect/reconnect', () => {
	let container
	afterAll(async done => {
		await container?.stop()
		done()
	})
	it('reconnects after a pod reschedule', async done => {
		const delay = timeout =>
			new Promise(res => setTimeout(() => res(), timeout))

		container = await new GenericContainer(
			'camunda/zeebe',
			'0.23.1',
			undefined,
			26500
		)
			.withExposedPorts(26500)
			.start()

		await delay(10000)

		const zbc = new ZBClient(`localhost`)
		await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')
		const worker = zbc.createWorker({
			loglevel: 'INFO',
			longPoll: 5000,
			taskHandler: (job, complete) => {
				complete.success()
			},
			taskType: 'disconnection-task',
		})
		const wf = await zbc.createWorkflowInstanceWithResult(
			'disconnection',
			{}
		)
		expect(wf.bpmnProcessId).toBeTruthy()
		// tslint:disable-next-line: no-console
		console.log('Stopping Zeebe Broker...')
		await container.stop()
		// tslint:disable-next-line: no-console
		console.log('Zeebe Broker stopped.')
		// tslint:disable-next-line: no-console
		console.log('Starting Zeebe Broker...')
		container = await new GenericContainer(
			'camunda/zeebe',
			'0.23.1',
			undefined,
			26500
		)
			.withExposedPorts(26500)
			.start()
		// tslint:disable-next-line: no-console
		console.log('Zeebe Broker started.')
		await delay(10000)
		await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')

		// tslint:disable-next-line: no-console
		console.log('Creating workflow...')
		const wf1 = await zbc.createWorkflowInstanceWithResult(
			'disconnection',
			{}
		)
		expect(wf1.bpmnProcessId).toBeTruthy()
		await worker.close()
		done()
	})
})
