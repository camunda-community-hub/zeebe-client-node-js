import { ZBClient } from '../../..'
import { createUniqueTaskType } from '../../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

const trace = async <T>(result: T) => {
	// tslint:disable-next-line: no-console
	// console.log(result)
	return result
}

let zbc: ZBClient
let wf: CreateProcessInstanceResponse

beforeEach(async () => {
	zbc = new ZBClient()
})

afterEach(
	() =>
		new Promise(async done => {
			try {
				if (wf?.processInstanceKey) {
					zbc.cancelProcessInstance(wf.processInstanceKey) // Cleanup any active processes
				}
			} finally {
				await zbc.close() // Makes sure we don't forget to close connection
				done(null)
			}
		})
)

test('Can update process variables with setVariables', () =>
	new Promise(async done => {
		jest.setTimeout(30000)

		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/conditional-pathway.bpmn',
			messages: [],
			taskTypes: ['pathB', 'wait'],
		})

		// deepcode ignore PromiseNotCaughtNode: test
		const res = await zbc
			.deployProcess({
				definition: bpmn,
				name: `conditional-pathway-${processId}.bpmn`,
			})
			.then(trace)

		expect(res?.processes?.length).toBe(1)
		expect(res?.processes?.[0]?.bpmnProcessId).toBe(processId)

		// deepcode ignore PromiseNotCaughtNode: test
		wf = await zbc
			.createProcessInstance(processId, {
				conditionVariable: true,
			})
			.then(trace)

		const wfi = wf?.processInstanceKey
		expect(wfi).toBeTruthy()

		// deepcode ignore PromiseNotCaughtNode: test
		zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		}).then(trace)
		trace('Creating wait worker')
		zbc.createWorker({
			taskType: taskTypes.wait,
			taskHandler: async job => {
				expect(job?.processInstanceKey).toBe(wfi)
				trace(`Completing wait job for ${job.processInstanceKey}`)
				return job.complete()
			},
			loglevel: 'INFO',
		})

		zbc.createWorker({
			taskType: taskTypes.pathB,
			taskHandler: async job => {
				expect(job?.processInstanceKey).toBe(wfi)
				expect(job?.variables?.conditionVariable).toBe(false)
				const res1 = job.complete()
				done(null)
				return res1
			},
			loglevel: 'INFO',
		})
	}))
