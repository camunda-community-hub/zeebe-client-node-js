import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	it("Doesn't long poll by default", async done => {
		const zbc = new ZBClient('0.0.0.0:26500')
		let wf
		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)

		zbc.createWorker(
			'test',
			'console-log',
			async (job, complete, worker) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				complete(job.variables)
				expect(worker.pollCount > 5).toBe(true)
				await zbc.close()
				done()
			},
			{
				debug: true,
			}
		)
		setTimeout(async () => {
			wf = await zbc.createWorkflowInstance('hello-world', {})
		}, 3000)
	})
	it('Can long poll', async done => {
		let wf
		const zbcLongPoll = new ZBClient('0.0.0.0:26500', { longPoll: true })
		const res = await zbcLongPoll.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)

		zbcLongPoll.createWorker(
			'test',
			'console-log',
			(job, complete, worker) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				complete(job.variables)
				expect(worker.pollCount).toBe(1)
				done()
			},
			{
				debug: true,
			}
		)
		setTimeout(async () => {
			wf = await zbcLongPoll.createWorkflowInstance('hello-world', {})
		}, 3000)
	})
})
