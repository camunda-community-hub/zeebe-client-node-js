import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'
jest.setTimeout(25000)

describe('Await Outcome', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient(gatewayAddress, { loglevel: 'DEBUG' })
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Awaits a workflow outcome', async () => {
		await zbc.deployWorkflow('./src/__tests__/testdata/await-outcome.bpmn')
		const processId = 'await-outcome'
		const result = await zbc.createWorkflowInstanceWithResult(processId, {
			sourceValue: 5,
		})
		expect(result.variables.sourceValue).toBe(5)
	})
	it('can override the gateway timeout', async () => {
		await zbc.deployWorkflow(
			'./src/__tests__/testdata/await-outcome-long.bpmn'
		)
		const processId = 'await-outcome-long'
		const result = await zbc.createWorkflowInstanceWithResult({
			bpmnProcessId: processId,
			requestTimeout: 25000,
			variables: {
				otherValue: 'rome',
				sourceValue: 5,
			},
		})
		expect(result.variables.sourceValue).toBe(5)
	})
	it('fetches a subset of variables', async () => {
		zbc = new ZBClient()
		await zbc.deployWorkflow('./src/__tests__/testdata/await-outcome.bpmn')
		const processId = 'await-outcome'
		const result = await zbc.createWorkflowInstanceWithResult({
			bpmnProcessId: processId,
			fetchVariables: ['otherValue'],
			variables: {
				otherValue: 'rome',
				sourceValue: 5,
			},
		})
		// @TODO - uncomment when https://github.com/zeebe-io/zeebe/pull/3253 gets merged
		// expect(result.variables.sourceValue).toBe(undefined)
		expect(result.variables.otherValue).toBe('rome')
	})
})
