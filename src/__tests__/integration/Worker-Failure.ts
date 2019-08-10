import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	const zbc = new ZBClient('0.0.0.0:26500')
	let wfi

	afterAll(async () => {
		await zbc.cancelWorkflowInstance(wfi)
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Causes a retry with complete.failure()', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/worker-failure.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure')

		const wf = await zbc.createWorkflowInstance('worker-failure', {
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
			'wait-worker-failure',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				// Succeed on the third attempt
				if (job.retries === 1) {
					complete.success()
					expect(job.retries).toBe(1)
					done()
					return
				}
				complete.failure('Triggering a retry')
			}
		)
	})
})
