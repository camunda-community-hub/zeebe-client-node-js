import { ZBClient } from '../../index'

describe('ZBClient', () => {
	it('deploys a workflow', async () => {
		const zbc = new ZBClient('localhost')
		const result = await zbc.deployWorkflow(
			`./src/__tests__/testdata/Client-DeployWorkflow.bpmn`
		)
		expect(result.workflows[0].bpmnProcessId).toBe('test-process')
	})
})
