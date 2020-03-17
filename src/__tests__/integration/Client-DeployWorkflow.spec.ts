import { ZBClient } from '../../index'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(20000)
describe('ZBClient', () => {
	it('deploys a workflow', async () => {
		const zbc = new ZBClient()
		const { bpmn, processId } = createUniqueTaskType({
			bpmnFilePath: `./src/__tests__/testdata/Client-DeployWorkflow.bpmn`,
			messages: [],
			taskTypes: [],
		})
		const result = await zbc.deployWorkflow({
			definition: bpmn,
			name: `Client-DeployWorkflow-${processId}.bpmn`,
		})
		await zbc.close()
		expect(result.workflows[0].bpmnProcessId).toBe(processId)
	})
})
