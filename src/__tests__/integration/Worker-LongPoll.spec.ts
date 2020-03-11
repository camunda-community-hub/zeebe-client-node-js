import * as uuid from 'uuid'
import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	let zbcLongPoll

	afterAll(async () => {
		const zbc = new ZBClient()
		// await zbc.cancelWorkflowInstance(wf2.workflowInstanceKey)
		await zbcLongPoll.close()
		await zbc.close()
	})

	/**
	 * This test is currently disabled
	 */
	it('Does long poll by default', async done => {
		jest.setTimeout(40000)
		zbcLongPoll = new ZBClient({
			longPoll: 60000,
		})
		const { processId, bpmn } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Worker-LongPoll.bpmn',
			messages: [],
			taskTypes: [],
		})
		const res = await zbcLongPoll.deployWorkflow({
			definition: bpmn,
			name: `worker-longPoll-${processId}.bpmn`,
		})
		expect(res.workflows.length).toBe(1)

		const worker = zbcLongPoll.createWorker(
			uuid.v4(),
			async (job, complete) => {
				// expect(job.workflowInstanceKey).toBe(wf2.workflowInstanceKey)
				await complete.success(job.variables)
				// expect(worker.pollCount).toBe(1)
				// done()
			},
			{ loglevel: 'NONE', debug: true }
		)
		// Wait to outside 10s - it should have polled once when it gets the job
		setTimeout(async () => {
			expect(worker.pollCount).toBe(2)
			done()
			// wf2 = await zbcLongPoll.createWorkflowInstance('long-poll', {})
		}, 35000)
	})
})
