import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

const zbc = new ZBClient()

afterAll(async () => {
	await zbc.close() // Makes sure we don't forget to close connection
})

test('does not retry the deployment of a broken BPMN file', async () => {
	expect.assertions(1)
	try {
		await zbc.deployProcess(
			'./src/__tests__/testdata/Client-BrokenBpmn.bpmn'
		)
	} catch (e: any) {
		expect(e.message.indexOf('3 INVALID_ARGUMENT:')).toBe(0)
	}
})
