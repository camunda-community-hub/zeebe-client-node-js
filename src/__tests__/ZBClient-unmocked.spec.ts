import { ZBClient } from '..'

jest.setTimeout(12000)

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
	it('does not throw when there is no broker, by default', async done => {
		const zbc = new ZBClient('localhoster')
		setTimeout(async () => {
			// tslint:disable-next-line
			console.log(
				'^^^ The gRPC connection failure message above is expected. ^^^'
			)
			await zbc.close()
			expect(true).toBe(true)
			// We have to wait ten seconds here, because the operation retry logic keeps it alive (I think...)
			setTimeout(() => done(), 10000)
		}, 2000)
		// tslint:disable-next-line
		console.log(
			'vvv The gRPC connection failure message below is expected. vvv'
		)
		await zbc.deployWorkflow('./src/__tests__/testdata/hello-world.bpmn')
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
