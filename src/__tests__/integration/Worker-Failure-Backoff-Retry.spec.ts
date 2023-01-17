import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

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

test('Can specify a retryBackoff with complete.failure()', () =>
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

		let then = new Date()
		zbc.createWorker({
			taskType: taskTypes['wait-worker-failure'],
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
