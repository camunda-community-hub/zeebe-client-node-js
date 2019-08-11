import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	let wf1
	let wf2

	afterAll(async () => {
		const zbc = new ZBClient('0.0.0.0:26500')
		await zbc.cancelWorkflowInstance(wf1.workflowInstanceKey)
		await zbc.cancelWorkflowInstance(wf2.workflowInstanceKey)
		await zbc.close()
	})

	it("Doesn't long poll by default", async done => {
		const zbc = new ZBClient('0.0.0.0:26500')
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-LongPoll.bpmn'
		)
		expect(res.workflows.length).toBe(1)

		zbc.createWorker(
			'test',
			'console-log-long-poll',
			async (job, complete, worker) => {
				expect(job.workflowInstanceKey).toBe(wf1.workflowInstanceKey)
				complete(job.variables)
				expect(worker.pollCount > 5).toBe(true)
				// await zbc.cancelWorkflowInstance(wf.workflowInstanceKey)
				await zbc.close()
				done()
			},
			{
				debug: true,
			}
		)
		setTimeout(async () => {
			wf1 = await zbc.createWorkflowInstance('long-poll', {})
		}, 3000)
	})

	it('Can long poll', async done => {
		const zbcLongPoll = new ZBClient('0.0.0.0:26500', {
			longPoll: true,
		})
		const res = await zbcLongPoll.deployWorkflow(
			'./src/__tests__/testdata/Worker-LongPoll.bpmn'
		)
		expect(res.workflows.length).toBe(1)

		zbcLongPoll.createWorker(
			'test',
			'console-log-long-poll',
			async (job, complete, worker) => {
				expect(job.workflowInstanceKey).toBe(wf2.workflowInstanceKey)
				complete(job.variables)
				expect(worker.pollCount).toBe(1)
				// await zbcLongPoll.cancelWorkflowInstance(wf.workflowInstanceKey)
				await zbcLongPoll.close()
				done()
			},
			{
				debug: true,
			}
		)
		setTimeout(async () => {
			wf2 = await zbcLongPoll.createWorkflowInstance('long-poll', {})
		}, 3000)
	})
})
