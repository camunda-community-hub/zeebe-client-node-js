import { ZBClient } from '..'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(13000)

test('ZBClient constructor throws an exception when there is no broker and retry is false', async () => {
	const zbc = new ZBClient('localhoster', { retry: false })
	expect.assertions(1)
	try {
		await zbc.deployProcess('./src/__tests__/testdata/hello-world.bpmn')
	} catch (e: any) {
		expect(e.message.indexOf('14 UNAVAILABLE:')).toEqual(0)
	}
	await zbc.close()
})

test('cancelProcessInstance throws an exception when workflowInstanceKey is malformed', async () => {
	const zbc = new ZBClient('localhoster', { retry: false })
	expect.assertions(1)
	try {
		await zbc.cancelProcessInstance('hello-world')
	} catch (e: any) {
		expect(e).toMatchSnapshot()
	}
	await zbc.close()
})
