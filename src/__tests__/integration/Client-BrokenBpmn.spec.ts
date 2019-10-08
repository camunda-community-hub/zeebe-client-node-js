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

	it('does not retry the deployment of a broken BPMN file', async () => {
		expect.assertions(1)
		try {
			await zbc.deployWorkflow(
				'./src/__tests__/testdata/Client-BrokenBpmn.bpmn'
			)
		} catch (e) {
			expect(e.message.indexOf('3 INVALID_ARGUMENT:')).toBe(0)
		}
	})
})
