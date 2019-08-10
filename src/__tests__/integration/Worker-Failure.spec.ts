import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient('0.0.0.0:26500')
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})
	it('Causes a retry with complete.failure()', async done => {
		const res = await zbc.deployWorkflow('./test/conditional-pathway.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')

		const wf = await zbc.createWorkflowInstance('condition-test', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		await zbc.createWorker('test2', 'wait', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)

			// Succeed on the third attempt
			if (job.retries === 1) {
				complete.success()
				done()
				expect(job.retries).toBe(1)
				return
			}
			complete.failure('Triggering a retry')
		})
	})
})
