import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../..'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

/**
 * Note: This test needs to be modified to leave its process instance active so the incident can be manually verified
 */
jest.setTimeout(30000)

let wfi
const zbc = new ZBClient()
let processId: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/Worker-RaiseIncident.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

afterAll(async () => {
	zbc.cancelProcessInstance(wfi)
	await zbc.close()
	await cancelProcesses(processId)
})

test('Can raise an Operate incident with complete.failure()', () =>
	new Promise(async done => {
		const wf = await zbc.createProcessInstance(processId, {
			conditionVariable: true,
		})
		wfi = wf.processInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		await zbc.createWorker({
			taskType: 'wait-raise-incident',
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wfi)
				return job.complete(job.variables)
			},
			loglevel: 'NONE',
		})

		await zbc.createWorker({
			taskType: 'pathB-raise-incident',
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				const res1 = await job.fail('Raise an incident in Operate', 0)
				// Manually verify that an incident has been raised
				await job.cancelWorkflow()
				// comment out the preceding line for the verification test
				done(null)
				return res1
			},
			maxJobsToActivate: 1,
			loglevel: 'NONE',
		})
	}))
