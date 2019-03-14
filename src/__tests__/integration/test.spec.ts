import { ZBClient } from '../../index'

describe('ZBClient', () => {
	it('deploys a workflow', async () => {
		const zbc = new ZBClient('localhost')
		const result = await zbc.deployWorkflow(`${__dirname}/test.bpmn`)
		expect(result.workflows[0].bpmnProcessId).toBe('hello-world')
	})
})
