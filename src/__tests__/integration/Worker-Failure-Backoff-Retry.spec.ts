import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../..'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'


process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(60000)

let zbc = new ZBClient()
let wf: CreateProcessInstanceResponse | undefined
let processId: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/Worker-Failure1.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey)
		}
	} catch (e: any) {
		// console.log('Caught NOT FOUND') // @DEBUG
	} finally {

	}
})

afterAll(async () => {
	await zbc.close()
	await cancelProcesses(processId)
})

test('Can specify a retryBackoff with complete.failure()', () =>
	new Promise(async resolve => {

		wf = await zbc.createProcessInstance({
			bpmnProcessId: processId,
			variables: {
				conditionVariable: true
			}
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

		let then = new Date()
		const w = zbc.createWorker({
			taskType: 'wait-worker-failure',
			taskHandler: async job => {
				// Succeed on the third attempt
				if (job.retries === 1) {
					const now = new Date()
					const res1 = await job.complete()
					expect(job.processInstanceKey).toBe(wfi)
					expect((now as any) - (then as any)).toBeGreaterThan(1800)
					wf = undefined

					zbc.cancelProcessInstance(wfi)
					resolve(null)
					await w.close()
					return res1
				}
				then = new Date()
				// Fail on the first attempt, with a 2s backoff
				return job.fail({
					errorMessage:
						'Triggering a retry with a two second back-off',
					retryBackOff: 2000,
					retries: 1,
				})
			},
			loglevel: 'NONE',
		})
	}))
