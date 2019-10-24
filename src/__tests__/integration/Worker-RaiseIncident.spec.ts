import { ZBClient } from '../..'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

/**
 * Note: This test leaves its workflow instance active so the incident can be manually verified
 */
describe('ZBWorker', () => {
	let wfi
	const zbc = new ZBClient(gatewayAddress)

	afterAll(async () => {
		zbc.cancelWorkflowInstance(wfi)
		await zbc.close()
	})

	it('Can raise an Operate incident with complete.failure()', async done => {
		jest.setTimeout(15000)
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-RaiseIncident.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('raise-incident')

		const wf = await zbc.createWorkflowInstance('raise-incident', {
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
			'test2',
			'wait-raise-incident',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				complete.success(job)
			},
			{ loglevel: 'NONE' }
		)

		await zbc.createWorker(
			'test2',
			'pathB-raise-incident',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				complete.failure('Raise an incident in Operate', 0)
				// Manually verify that an incident has been raised
				done()
			},
			{ longPoll: 10000, maxJobsToActivate: 1, loglevel: 'NONE' }
		)
	})
})
