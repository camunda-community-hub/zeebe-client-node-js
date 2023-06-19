import { v4 as uuid } from 'uuid'
import { DeployProcessResponse, ZBClient } from '../..'
import { cancelProcesses } from '../../lib/cancelProcesses'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(45000)
const zbc = new ZBClient()
let deploy: DeployProcessResponse

beforeAll(async () => {
	deploy = await zbc.deployProcess('./src/__tests__/testdata/Client-MessageStart.bpmn')
})

afterAll(async () => {
	await zbc.close()
	await cancelProcesses(deploy.processes[0].bpmnProcessId)
})

test('Can publish a message', () =>
	new Promise(async done => {
		const randomId = uuid()

		// Wait 1 second to make sure the deployment is complete
		await new Promise(res => setTimeout(() => res(null), 1000))

		await zbc.publishMessage({
			name: 'MSG-START_JOB',
			variables: {
				testKey: randomId,
			},
			correlationKey: 'something'
		})

		zbc.createWorker({
			taskType: 'console-log-msg-start',
			taskHandler: async job => {
				const res = await job.complete()
				expect(job.variables.testKey).toBe(randomId) // Makes sure the worker isn't responding to another message
				done(null)
				return res
			},
			loglevel: 'NONE',
		})
	}))
