import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../..'
import { CreateProcessInstanceResponse, DeployProcessResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

const trace = async <T>(result: T) => {
	// tslint:disable-next-line: no-console
	// console.log(result)
	return result
}

const zbc = new ZBClient()
let wf: CreateProcessInstanceResponse
let deploy: DeployProcessResponse
let processId: string

beforeAll(async () => {
	deploy = await zbc.deployProcess('./src/__tests__/testdata/conditional-pathway.bpmn')
	processId = deploy.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

afterAll(() =>
	new Promise(async done => {
		try {
			if (wf?.processInstanceKey) {
				zbc.cancelProcessInstance(wf.processInstanceKey) // Cleanup any active processes
			}
		} finally {
			await zbc.close() // Makes sure we don't forget to close connection
			done(null)
		}
		await cancelProcesses(processId)
	})
)

test('Can update process variables with setVariables', () =>
	new Promise(async done => {
		jest.setTimeout(30000)

		wf = await zbc
			.createProcessInstance({
				bpmnProcessId: processId,
				variables: {
					conditionVariable: true
				}
			})
			.then(trace)

		const wfi = wf?.processInstanceKey
		expect(wfi).toBeTruthy()

		zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		}).then(trace)

		zbc.createWorker({
			taskType: 'wait',
			taskHandler: async job => {
				expect(job?.processInstanceKey).toBe(wfi)
				trace(`Completing wait job for ${job.processInstanceKey}`)
				return job.complete()
			},
			loglevel: 'INFO',
		})

		zbc.createWorker({
			taskType: 'pathB',
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
