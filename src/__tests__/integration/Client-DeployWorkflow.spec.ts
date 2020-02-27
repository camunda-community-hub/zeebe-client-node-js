import { ZBClient } from '../../index'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient', () => {
	it('deploys a workflow', async () => {
		const zbc = new ZBClient()
		const result = await zbc.deployWorkflow(
			`./src/__tests__/testdata/Client-DeployWorkflow.bpmn`
		)
		await zbc.close()
		expect(result.workflows[0].bpmnProcessId).toBe('test-process')
	})
})
