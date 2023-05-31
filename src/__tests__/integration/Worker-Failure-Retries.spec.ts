import { ZBClient } from '../..'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

// const trace = <T>(res: T) => {
// 	// tslint:disable-next-line: no-console
// 	console.log(res)
// 	return res
// }
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
	} catch (e: any) {
		// console.log('Caught NOT FOUND') // @DEBUG
	} finally {
		await zbc.close() // Makes sure we don't forget to close connection
	}
})

test('Decrements the retries count by default', () =>
	new Promise(async done => {
		await zbc.deployProcess('./src/__tests__/testdata/Worker-Failure-Retries.bpmn')
		wf = await zbc.createProcessInstance('worker-failure-retries', {
			conditionVariable: true,
		})
		let called = false

		const worker = zbc.createWorker({
			taskType: 'service-task-worker-failure-retries',
			taskHandler: job => {
				if (!called) {
					expect(job.retries).toBe(100)
					called = true
					return job.fail('Some reason')
				}
				expect(job.retries).toBe(99)
				done(null)
				return job.complete().then(async res => {
					await worker.close()
					return res
				})
			}
		})
	})
)

test('Set the retries to a specific number when provided with one via simple signature', () =>
	new Promise(async done => {
		await zbc.deployProcess('./src/__tests__/testdata/Worker-Failure-Retries.bpmn')
		wf = await zbc.createProcessInstance('worker-failure-retries', {
			conditionVariable: true,
		})
		let called = false

		const worker = zbc.createWorker({
			taskType: 'service-task-worker-failure-retries',
			taskHandler: job => {
				if (!called) {
					expect(job.retries).toBe(100)
					called = true
					return job.fail('Some reason', 101)
				}
				expect(job.retries).toBe(101)
				done(null)
				return job.complete().then(async res => {
					await worker.close()
					return res
				})
			}
		})
	})
)

test('Set the retries to a specific number when provided with one via object signature', () =>
	new Promise(async done => {
		await zbc.deployProcess('./src/__tests__/testdata/Worker-Failure-Retries.bpmn')
		wf = await zbc.createProcessInstance('worker-failure-retries', {
			conditionVariable: true,
		})
		let called = false

		const worker = zbc.createWorker({
			taskType: 'service-task-worker-failure-retries',
			taskHandler: job => {
				if (!called) {
					expect(job.retries).toBe(100)
					called = true
					return job.fail({ errorMessage: 'Some reason', retries: 101})
				}
				expect(job.retries).toBe(101)
				done(null)
				return job.complete().then(async res => {
					await worker.close()
					return res
				})
			}
		})
	})
)
