import { ZBClient } from '../../index'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(20000)

test('deploys a process', async () => {
	const zbc = new ZBClient()
	const result = await zbc.deployProcess(`./src/__tests__/testdata/Client-DeployWorkflow.bpmn`)
	await zbc.close()
	expect(result.processes[0].bpmnProcessId).toBeTruthy()
})
