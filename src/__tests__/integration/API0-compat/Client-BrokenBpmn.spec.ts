import { ZBClient } from '../../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

test('does not retry the deployment of a broken BPMN file', async () => {
	expect.assertions(1)
	const zbc = new ZBClient()
	try {
		await zbc.deployWorkflow(
			'./src/__tests__/testdata/Client-BrokenBpmn.bpmn'
		)
	} catch (e) {
		await zbc.close()
		expect(e.message.indexOf('3 INVALID_ARGUMENT:')).toBe(0)
	}
})
