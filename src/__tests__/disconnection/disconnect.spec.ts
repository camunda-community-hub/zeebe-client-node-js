// tslint:disable-next-line: no-implicit-dependencies
import { GenericContainer, Wait } from '@sitapati/testcontainers'
import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

const ZEEBE_DOCKER_TAG = '1.0.0-alpha7'

jest.setTimeout(900000)

let container
let worker

afterEach(async () => {
	await container?.stop()
	await worker?.close()
})

function log(msg) {
	// tslint:disable-next-line: no-console
	console.log(new Date().toString(), msg) // @DEBUG
}

test('reconnects after a pod reschedule', async done => {
	let readyCount = 0
	let errorCount = 0
	const delay = timeout =>
		new Promise(res => setTimeout(() => res(null), timeout))

	// tslint:disable-next-line: no-console
	log('##### Starting container') // @DEBUG

	container = await new GenericContainer(
		'camunda/zeebe',
		ZEEBE_DOCKER_TAG,
		undefined,
		26500
	)
		.withExposedPorts(26500)
		.withWaitStrategy(Wait.forLogMessage('Bootstrap Broker-0 succeeded.'))
		.start()

	await delay(10000)

	const zbc = new ZBClient(`localhost`)
	// tslint:disable-next-line: no-console
	log('##### Deploying workflow') // @DEBUG

	await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')
	worker = zbc
		.createWorker({
			longPoll: 10000,
			pollInterval: 300,
			taskHandler: job => {
				// tslint:disable-next-line: no-console
				log('##### Executing task handler') // @DEBUG

				return job.complete()
			},
			taskType: 'disconnection-task',
		})
		.on('connectionError', () => {
			errorCount++
		})
		.on('ready', () => {
			readyCount++
		})

	// tslint:disable-next-line: no-console
	log('##### Starting workflow') // @DEBUG

	const wf = await zbc.createWorkflowInstanceWithResult({
		bpmnProcessId: 'disconnection',
		requestTimeout: 25000,
		variables: {},
	})
	expect(wf.bpmnProcessId).toBeTruthy()

	// tslint:disable-next-line: no-console
	log('##### Workflow finished') // @DEBUG

	// tslint:disable-next-line: no-console
	log('##### Stopping container...') // @DEBUG

	await container.stop()

	// tslint:disable-next-line: no-console
	log('##### Container stopped.') // @DEBUG

	// tslint:disable-next-line: no-console
	log('##### Starting container....') // @DEBUG

	container = await new GenericContainer(
		'camunda/zeebe',
		ZEEBE_DOCKER_TAG,
		undefined,
		26500
	)
		.withExposedPorts(26500)
		.withEnv('ZEEBE_LOG_LEVEL', 'trace')
		.withWaitStrategy(Wait.forLogMessage('Bootstrap Broker-0 succeeded.'))
		.start()

	// tslint:disable-next-line: no-console
	log('##### Container started.') // @DEBUG

	await delay(10000)

	// tslint:disable-next-line: no-console
	log('##### Deploying workflow 2') // @DEBUG
	await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')

	// tslint:disable-next-line: no-console
	// console.log('Workflow 2 deployed', _) // @DEBUG

	await delay(15000)

	// tslint:disable-next-line: no-console
	log('##### Starting workflow 2') // @DEBUG

	const wf1 = await zbc.createWorkflowInstanceWithResult('disconnection', {})
	expect(wf1.bpmnProcessId).toBeTruthy()
	await worker.close()
	await container.stop()
	container = undefined
	worker = undefined
	expect(readyCount).toBe(2)
	expect(errorCount).toBe(1)
	done()
})

test('a worker that started first, connects to a broker that starts later', async done => {
	let readyCount = 0
	let errorCount = 0

	const delay = timeout =>
		new Promise(res => setTimeout(() => res(null), timeout))

	const zbc = new ZBClient(`localhost`)
	worker = zbc
		.createWorker({
			taskHandler: job => job.complete(),
			taskType: 'disconnection-task',
		})
		.on('connectionError', () => {
			errorCount++
		})
		.on('ready', () => {
			readyCount++
		})

	container = await new GenericContainer(
		'camunda/zeebe',
		ZEEBE_DOCKER_TAG,
		undefined,
		26500
	)
		.withExposedPorts(26500)
		.withWaitStrategy(Wait.forLogMessage('Bootstrap Broker-0 succeeded.'))
		.start()

	await delay(10000)

	await zbc.deployWorkflow('./src/__tests__/testdata/disconnection.bpmn')
	await delay(1000) // Ensure deployment has happened
	const wf = await zbc.createWorkflowInstanceWithResult('disconnection', {})
	expect(wf.bpmnProcessId).toBeTruthy()
	await worker.close()
	await container.stop()
	container = undefined
	worker = undefined
	expect(readyCount).toBe(1)
	expect(errorCount).toBe(1)
	done()
})
