import { ZBClient } from '../../..'
import { createUniqueTaskType } from '../../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../../lib/interfaces-grpc-1.0'

const trace = <T>(res: T) => {
	// tslint:disable-next-line: no-console
	console.log(res)
	return res
}
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(60000)

let zbc: ZBClient
let wf: CreateProcessInstanceResponse | undefined

beforeEach(() => {
	// tslint:disable-next-line: no-console
	// console.log('Creating client...') // @DEBUG
	zbc = new ZBClient()
})

afterEach(async done => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey)
		}
	} catch (e) {
		// console.log('Caught NOT FOUND') // @DEBUG
	} finally {
		// tslint:disable-next-line: no-console
		// console.log('Closing client...') // @DEBUG
		await zbc.close() // Makes sure we don't forget to close connection
		// tslint:disable-next-line: no-console
		// console.log('Client closed.') // @DEBUG

		done()
	}
})

test('Causes a retry with complete.failure()', () =>
	new Promise(async resolve => {
		const { bpmn, processId, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Worker-Failure1.bpmn',
			messages: [],
			taskTypes: ['wait-worker-failure'],
		})
		// tslint:disable-next-line: no-console
		// console.log('Deploying 1...') // @DEBUG
		const res = await zbc
			.deployProcess({
				definition: bpmn,
				name: `worker-failure-${processId}.bpmn`,
			})
			.catch(trace)

		expect(res.processes.length).toBe(1)
		expect(res.processes[0].bpmnProcessId).toBe(processId)

		// tslint:disable-next-line: no-console
		// console.log('Creating process instance 1...') // @DEBUG
		wf = await zbc.createProcessInstance(processId, {
			conditionVariable: true,
		})
		const wfi = wf.processInstanceKey
		expect(wfi).toBeTruthy()

		// tslint:disable-next-line: no-console
		// console.log('Set variables 1...') // @DEBUG
		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		// tslint:disable-next-line: no-console
		// console.log('Creating worker 1...') // @DEBUG
		zbc.createWorker(
			taskTypes['wait-worker-failure'],
			async (job, complete) => {
				// Succeed on the third attempt
				if (job.retries === 1) {
					// tslint:disable-next-line: no-console
					// console.log('Complete Job 1...') // @DEBUG
					await complete.success()
					// tslint:disable-next-line: no-console
					// console.log('Job completed 1') // @DEBUG

					expect(job.processInstanceKey).toBe(wfi)
					expect(job.retries).toBe(1)
					wf = undefined

					return resolve(null)
				}
				await complete.failure('Triggering a retry')
			},
			{ loglevel: 'NONE' }
		)
	}))

test('Does not fail a process when the handler throws, by default', async done => {
	const { bpmn, processId, taskTypes } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/Worker-Failure2.bpmn',
		messages: [],
		taskTypes: ['console-log-worker-failure-2'],
	})
	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `worker-failure-2-${processId}.bpmn`,
	})
	expect(res.processes.length).toBe(1)
	expect(res.processes[0].bpmnProcessId).toBe(processId)
	// tslint:disable-next-line: no-console
	// console.log('Creating process instance 2...') // @DEBUG
	wf = await zbc.createProcessInstance(processId, {})

	let alreadyFailed = false

	// tslint:disable-next-line: no-console
	// console.log('Creating worker 2...') // @DEBUG
	// Faulty worker - throws an unhandled exception in task handler
	const w = zbc.createWorker(
		taskTypes['console-log-worker-failure-2'],
		async (_, complete) => {
			// tslint:disable-next-line: no-console
			// console.log('Completing job 2...') // @DEBUG

			if (alreadyFailed) {
				await zbc.cancelProcessInstance(wf!.processInstanceKey) // throws if not found. Should NOT throw in this test
				complete.success()
				return w.close().then(() => done())
			}
			alreadyFailed = true
			throw new Error(
				'Unhandled exception in task handler for testing purposes'
			) // Will be caught in the library
		},
		{
			loglevel: 'NONE',
			pollInterval: 10000,
		}
	)
})

test('Fails a process when the handler throws and options.failProcessOnException is set', async done => {
	const { bpmn, taskTypes, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/Worker-Failure3.bpmn',
		messages: [],
		taskTypes: ['console-log-worker-failure-3'],
	})
	// tslint:disable-next-line: no-console
	// console.log('Deploy process 3....') // @DEBUG

	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `worker-failure-3-${processId}.bpmn`,
	})

	expect(res.processes.length).toBe(1)
	expect(res.processes[0].bpmnProcessId).toBe(processId)
	// tslint:disable-next-line: no-console
	// console.log('Creating process instance 3...') // @DEBUG
	wf = await zbc.createProcessInstance(processId, {})

	let alreadyFailed = false
	// tslint:disable-next-line: no-console
	// console.log('Creating worker...') // @DEBUG
	// Faulty worker
	const w = zbc.createWorker(
		taskTypes['console-log-worker-failure-3'],
		() => {
			if (alreadyFailed) {
				// It polls multiple times a second, and we need it to only throw once
				return
			}
			alreadyFailed = true
			testProcessInstanceExists() // waits 1000ms then checks
			throw new Error(
				'Unhandled exception in task handler for test purposes'
			) // Will be caught in the library
		},
		{
			failProcessOnException: true,
			loglevel: 'NONE',
		}
	)

	function testProcessInstanceExists() {
		setTimeout(async () => {
			try {
				await zbc.cancelProcessInstance(wf!.processInstanceKey) // throws if not found. SHOULD throw in this test
			} catch (e) {
				w.close().then(() => done())
			}
		}, 1500)
	}
})
