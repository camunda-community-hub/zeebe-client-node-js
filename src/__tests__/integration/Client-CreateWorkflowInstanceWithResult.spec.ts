import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('Await Outcome', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient(gatewayAddress)
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})
	it('Awaits a workflow outcome', async () => {
		zbc = new ZBClient()
		await zbc.deployWorkflow('./src/__tests__/testdata/await-outcome.bpmn')
		const processId = 'await-outcome'
		const result = await zbc.createWorkflowInstanceWithResult(
			processId,
			{
				sourceValue: 5,
			},
			{
				maxRetries: 10,
				requestTimeout: 10000,
				retry: true,
			}
		)
		expect(result.variables.targetValue).toBe(5)
	})
})
