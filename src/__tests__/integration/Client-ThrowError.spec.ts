import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('ZBClient.throwError', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient(gatewayAddress)
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Throws a business error that is caught in the process', async () => {
		await zbc.deployWorkflow(
			'./src/__tests__/testdata/Client-ThrowError.bpmn'
		)
		const processId = 'throw-bpmn-error'
		zbc.createWorker(null, 'throw-bpmn-error', (_, complete) =>
			complete.error('BUSINESS_ERROR', "Well, that didn't work")
		)
		zbc.createWorker(null, 'sad-flow', (_, complete) =>
			complete.success({
				bpmnErrorCaught: true,
			})
		)
		const result = await zbc.createWorkflowInstanceWithResult(processId, {})
		expect(result.variables.bpmnErrorCaught).toBe(true)
	})
})
