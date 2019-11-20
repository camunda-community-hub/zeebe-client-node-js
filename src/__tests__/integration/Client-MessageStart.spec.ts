import { v4 as uuid } from 'uuid'
import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('ZBClient', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient(gatewayAddress)
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Can start a workflow with a message', async done => {
		const deploy = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Client-MessageStart.bpmn'
		)
		expect(deploy.key).toBeTruthy()

		const randomId = uuid()

		await zbc.publishStartMessage({
			name: 'MSG-START_JOB',
			timeToLive: 1000,
			variables: {
				testKey: randomId,
			},
		})

		zbc.createWorker(
			'test2',
			'console-log-msg',
			async (job, complete) => {
				complete.success(job.variables)
				expect(job.variables.testKey).toBe(randomId) // Makes sure the worker isn't responding to another message
				done()
			},
			{ loglevel: 'NONE' }
		)
	})
})
