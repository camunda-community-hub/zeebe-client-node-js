import { v4 as uuid } from 'uuid'
import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient()
	})

	afterEach(async () => {
		await zbc.close()
	})

	it('Can start a workflow with a message', async done => {
		const { bpmn, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Client-MessageStart.bpmn',
			processIdPrefix: 'start-',
			taskTypes: ['console-log-msg-start'],
		})
		const deploy = await zbc.deployWorkflow({
			definition: bpmn,
			name: 'Client-MessageStart.bpmn',
		})
		expect(deploy.key).toBeTruthy()

		const randomId = uuid()

		await zbc.publishStartMessage({
			name: 'MSG-START_JOB',
			timeToLive: 2000,
			variables: {
				testKey: randomId,
			},
		})

		zbc.createWorker(
			taskTypes['console-log-msg-start'],
			async (job, complete) => {
				await complete.success()
				expect(job.variables.testKey).toBe(randomId) // Makes sure the worker isn't responding to another message
				await zbc.cancelWorkflowInstance(job.workflowInstanceKey)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})
})
