import { ZBClient } from '../../index'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'
process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient', () => {
	it('deploys a workflow', async () => {
		const zbc = new ZBClient(gatewayAddress)
		const result = await zbc.deployWorkflow(
			`./src/__tests__/testdata/Client-DeployWorkflow.bpmn`
		)
		expect(result.workflows[0].bpmnProcessId).toBe('test-process')
	})
})
