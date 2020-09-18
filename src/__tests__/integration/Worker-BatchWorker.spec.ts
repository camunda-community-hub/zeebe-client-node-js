import { Duration, ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
let zbc: ZBClient

beforeEach(async () => {
	zbc = new ZBClient()
})

afterEach(async done => {
	await zbc.close() // Makes sure we don't forget to close connection
	done()
})

test('BatchWorker gets ten jobs', async done => {
	const { bpmn, taskTypes, processId } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
		messages: [],
		taskTypes: ['console-log'],
	})
	const res = await zbc.deployWorkflow({
		definition: bpmn,
		name: `service-hello-world-${processId}.bpmn`,
	})

	expect(res.workflows.length).toBe(1)

	for (let i = 0; i < 10; i++) {
		await zbc.createWorkflowInstance(processId, {})
	}

	zbc.createBatchWorker({
		jobBatchMaxTime: Duration.seconds.from(120),
		jobBatchMinSize: 10,
		loglevel: 'NONE',
		taskHandler: async jobs => {
			expect(jobs.length).toBe(10)
			await Promise.all(jobs.map(job => job.success()))
			done()
		},
		taskType: taskTypes['console-log'],
	})
})
