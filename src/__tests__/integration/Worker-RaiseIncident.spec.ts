import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

/**
 * Note: This test needs to be modified to leave its workflow instance active so the incident can be manually verified
 */
jest.setTimeout(30000)

describe('ZBWorker', () => {
	let wfi
	const zbc = new ZBClient()

	afterAll(async () => {
		zbc.cancelWorkflowInstance(wfi)
		await zbc.close()
	})

	it('Can raise an Operate incident with complete.failure()', async done => {
		const { bpmn, processId, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Worker-RaiseIncident.bpmn',
			messages: [],
			taskTypes: ['wait-raise-incident', 'pathB-raise-incident'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: `raise-incident-${processId}.bpmn`,
		})
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe(processId)

		const wf = await zbc.createWorkflowInstance(processId, {
			conditionVariable: true,
		})
		wfi = wf.workflowInstanceKey
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
				expect(job.workflowInstanceKey).toBe(wfi)
				await complete.success(job.variables)
			},
			{ loglevel: 'NONE' }
		)

		await zbc.createWorker(
			taskTypes['pathB-raise-incident'],
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				await complete.failure('Raise an incident in Operate', 0)
				// Manually verify that an incident has been raised
				await zbc.cancelWorkflowInstance(job.workflowInstanceKey)
				// comment out the preceding line for the verification test
				done()
			},
			{ maxJobsToActivate: 1, loglevel: 'NONE' }
		)
	})
})
