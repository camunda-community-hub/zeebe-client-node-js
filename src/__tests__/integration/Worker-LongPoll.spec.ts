import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('ZBWorker', () => {
	let wf2

	afterAll(async () => {
		const zbc = new ZBClient(gatewayAddress)
		await zbc.cancelWorkflowInstance(wf2.workflowInstanceKey)
		await zbc.close()
	})

	it('Does long poll by default', async done => {
		jest.setTimeout(30000)
		const zbcLongPoll = new ZBClient(gatewayAddress)
		const res = await zbcLongPoll.deployWorkflow(
			'./src/__tests__/testdata/Worker-LongPoll.bpmn'
		)
		expect(res.workflows.length).toBe(1)

		zbcLongPoll.createWorker(
			'test',
			'console-log-long-poll',
			async (job, complete, worker) => {
				expect(job.workflowInstanceKey).toBe(wf2.workflowInstanceKey)
				complete.success(job.variables)
				expect(worker.pollCount).toBe(1)
				await zbcLongPoll.close()
				done()
			},
			{ loglevel: 'NONE', debug: true }
		)
		// Wait to outside 10s - it should have only polled once when it gets the job
		setTimeout(async () => {
			wf2 = await zbcLongPoll.createWorkflowInstance('long-poll', {})
		}, 13000)
	})
})
