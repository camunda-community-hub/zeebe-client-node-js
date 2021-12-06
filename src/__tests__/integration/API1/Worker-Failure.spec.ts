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
	zbc = new ZBClient()
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey)
		}
	} catch (e) {
		// console.log('Caught NOT FOUND') // @DEBUG
	} finally {
		await zbc.close() // Makes sure we don't forget to close connection
	}
})

test('Causes a retry with complete.failure()', () =>
	new Promise(async resolve => {
		const { bpmn, processId, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Worker-Failure1.bpmn',
			messages: [],
			taskTypes: ['wait-worker-failure'],
		})
		const res = await zbc
			.deployProcess({
				definition: bpmn,
				name: `worker-failure-${processId}.bpmn`,
			})
			.catch(trace)

		expect(res.processes.length).toBe(1)
		expect(res.processes[0].bpmnProcessId).toBe(processId)
		wf = await zbc.createProcessInstance(processId, {
			conditionVariable: true,
		})
		const wfi = wf.processInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		zbc.createWorker({
			taskType: taskTypes['wait-worker-failure'],
			taskHandler: async job => {
				// Succeed on the third attempt
				if (job.retries === 1) {
					const res1 = await job.complete()
					expect(job.processInstanceKey).toBe(wfi)
					expect(job.retries).toBe(1)
					wf = undefined

					resolve(null)
					return res1
				}
				return job.fail('Triggering a retry')
			},
			loglevel: 'NONE',
		})
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

	wf = await zbc.createProcessInstance(processId, {})

	let alreadyFailed = false

	// Faulty worker - throws an unhandled exception in task handler
	const w = zbc.createWorker({
		taskType: taskTypes['console-log-worker-failure-2'],
		taskHandler: async job => {
			if (alreadyFailed) {
				await zbc.cancelProcessInstance(wf!.processInstanceKey) // throws if not found. Should NOT throw in this test
				job.complete()
				return w.close().then(() => done())
			}
			alreadyFailed = true
			throw new Error(
				'Unhandled exception in task handler for testing purposes'
			) // Will be caught in the library
		},

		loglevel: 'NONE',
		pollInterval: 10000,
	})
})

test('Fails a process when the handler throws and options.failProcessOnException is set', async done => {
	const { bpmn, taskTypes, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/Worker-Failure3.bpmn',
		messages: [],
		taskTypes: ['console-log-worker-failure-3'],
	})

	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `worker-failure-3-${processId}.bpmn`,
	})

	expect(res.processes.length).toBe(1)
	expect(res.processes[0].bpmnProcessId).toBe(processId)

	wf = await zbc.createProcessInstance(processId, {})

	let alreadyFailed = false

	// Faulty worker
	const w = zbc.createWorker({
		taskType: taskTypes['console-log-worker-failure-3'],
		taskHandler: job => {
			if (alreadyFailed) {
				// It polls multiple times a second, and we need it to only throw once
				return job.forward()
			}
			alreadyFailed = true
			testProcessInstanceExists() // waits 1000ms then checks
			throw new Error(
				'Unhandled exception in task handler for test purposes'
			) // Will be caught in the library
		},
		failProcessOnException: true,
		loglevel: 'NONE',
	})

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
