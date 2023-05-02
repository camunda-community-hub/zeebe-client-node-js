import { v4 as uuid } from 'uuid'
import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(45000)
let zbc: ZBClient

beforeEach(async () => {
	zbc = new ZBClient()
})

afterEach(async () => {
	await zbc.close()
})

test('Can publish a message', () =>
	new Promise(async done => {
		const { bpmn, taskTypes, processId, messages } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Client-MessageStart.bpmn',
			messages: ['MSG-START_JOB'],
			taskTypes: ['console-log-msg-start'],
		})

		const deploy = await zbc.deployProcess({
			definition: bpmn,
			name: `Client-MessageStart-${processId}.bpmn`,
		})
		expect(deploy.key).toBeTruthy()

		const randomId = uuid()

		// Wait 1 second to make sure the deployment is complete
		await new Promise(res => setTimeout(() => res(null), 1000))

		await zbc.publishMessage({
			name: messages['MSG-START_JOB'],
			variables: {
				testKey: randomId,
			},
			correlationKey: 'something'
		})

		zbc.createWorker({
			taskType: taskTypes['console-log-msg-start'],
			taskHandler: async job => {
				const res = await job.complete()
				expect(job.variables.testKey).toBe(randomId) // Makes sure the worker isn't responding to another message
				done(null)
				return res
			},
			loglevel: 'NONE',
		})
	}))
