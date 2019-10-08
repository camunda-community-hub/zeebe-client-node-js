import { ZBClient } from '..'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(13000)

describe('ZBClient constructor', () => {
	it('throws an exception when there is no broker and retry is false', async () => {
		const zbc = new ZBClient('localhoster', { retry: false })
		expect.assertions(1)
		try {
			await zbc.deployWorkflow(
				'./src/__tests__/testdata/hello-world.bpmn'
			)
		} catch (e) {
			expect(e.message.indexOf('14 UNAVAILABLE:')).toEqual(0)
		}
	})
	it('throws an exception when workflowInstanceKey is malformed', async () => {
		const zbc = new ZBClient('localhoster', { retry: false })
		expect.assertions(1)
		try {
			await zbc.cancelWorkflowInstance('hello-world')
		} catch (e) {
			expect(e).toMatchSnapshot()
		}
	})
})
