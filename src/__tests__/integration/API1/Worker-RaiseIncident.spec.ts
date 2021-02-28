import { ZBClient } from '../../..'
import { createUniqueTaskType } from '../../../lib/createUniqueTaskType'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

/**
 * Note: This test needs to be modified to leave its process instance active so the incident can be manually verified
 */
jest.setTimeout(30000)

let wfi
const zbc = new ZBClient()

afterAll(async () => {
	zbc.cancelProcessInstance(wfi)
	await zbc.close()
})

test('Can raise an Operate incident with complete.failure()', async done => {
	const { bpmn, processId, taskTypes } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/Worker-RaiseIncident.bpmn',
		messages: [],
		taskTypes: ['wait-raise-incident', 'pathB-raise-incident'],
	})
	const res = await zbc.deployProcess({
		definition: bpmn,
		name: `raise-incident-${processId}.bpmn`,
	})
	expect(res.processes.length).toBe(1)
	expect(res.processes[0].bpmnProcessId).toBe(processId)

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

	await zbc.createWorker(
		taskTypes['wait-raise-incident'],
		async (job, complete) => {
			expect(job.processInstanceKey).toBe(wfi)
			await complete.success(job.variables)
		},
		{ loglevel: 'NONE' }
	)

	await zbc.createWorker(
		taskTypes['pathB-raise-incident'],
		async (job, complete) => {
			expect(job.processInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(false)
			await complete.failure('Raise an incident in Operate', 0)
			// Manually verify that an incident has been raised
			await zbc.cancelProcessInstance(job.processInstanceKey)
			// comment out the preceding line for the verification test
			done()
		},
		{ maxJobsToActivate: 1, loglevel: 'NONE' }
	)
})
