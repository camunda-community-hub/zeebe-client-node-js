import { ZBClient } from '..'
jest.unmock('node-grpc-client')

describe('ZBClient constructor', () => {
	it('throws an exception when there is no broker and retry is false', async () => {
		const zbc = new ZBClient('localhoster', { retry: false })
		expect.assertions(1)
		try {
			await zbc.deployWorkflow('./test/hello-world.bpmn')
		} catch (e) {
			expect(e.message.indexOf('14 UNAVAILABLE:')).toEqual(0)
		}
	})
	it('does not throw when there is no broker, by default', async done => {
		const zbc = new ZBClient('localhoster')
		setTimeout(() => {
			// tslint:disable-next-line
			console.log(
				'^^^ The gRPC connection failure message above is expected. ^^^'
			)
			zbc.close()
			expect(true).toBe(true)
			done()
		}, 4000)
		// tslint:disable-next-line
		console.log(
			'vvv The gRPC connection failure message below is expected. vvv'
		)
		await zbc.deployWorkflow('./test/hello-world.bpmn')
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
