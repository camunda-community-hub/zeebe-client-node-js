// tslint:disable-next-line: no-implicit-dependencies
import { GenericContainer } from '@sitapati/testcontainers'
import { ZBClient } from '../..'
// import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(60000)
let container
afterEach(async done => {
	await container?.stop()
	done()
})

test('reconnects after a pod reschedule', async done => {
	const delay = timeout =>
		new Promise(res => setTimeout(() => res(), timeout))

	container = await new GenericContainer(
		'camunda/zeebe',
		'0.23.2',
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
		taskHandler: (_, complete) => {
			complete.success()
		},
		taskType: 'disconnection-task',
	})
	const wf = await zbc.createWorkflowInstanceWithResult('disconnection', {})
	expect(wf.bpmnProcessId).toBeTruthy()

	await container.stop()

	container = await new GenericContainer(
		'camunda/zeebe',
		'0.23.1',
		undefined,
		26500
	)
		.withExposedPorts(26500)
		.start()

	await delay(10000)
	await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')

	const wf1 = await zbc.createWorkflowInstanceWithResult('disconnection', {})
	expect(wf1.bpmnProcessId).toBeTruthy()
	await worker.close()
	done()
})

test('a worker that started first, connects to a broker that starts later', async done => {
	const delay = timeout =>
		new Promise(res => setTimeout(() => res(), timeout))

	const zbc = new ZBClient(`localhost`)
	const worker = zbc.createWorker({
		loglevel: 'INFO',
		longPoll: 5000,
		taskHandler: (_, complete) => {
			complete.success()
		},
		taskType: 'disconnection-task',
	})

	container = await new GenericContainer(
		'camunda/zeebe',
		'0.23.2',
		undefined,
		26500
	)
		.withExposedPorts(26500)
		.start()

	await delay(10000)

	await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')

	const wf = await zbc.createWorkflowInstanceWithResult('disconnection', {})
	expect(wf.bpmnProcessId).toBeTruthy()
	await worker.close()
	done()
})
