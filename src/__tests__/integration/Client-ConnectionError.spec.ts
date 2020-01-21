import { ZBClient } from '../..'

jest.setTimeout(10000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('onReady Handler', () => {
	it(`Calls the onConnectionError handler if there is no broker`, async done => {
		let called = false
		const zbc2 = new ZBClient('localtoast: 267890', {
			onConnectionError: () => {
				called = true
			},
		}) // Broker doesn't exist!!!
		setTimeout(async () => {
			expect(called).toBe(true)
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			done()
		}, 5000)
	})

	it(`Does emit the connectionError event if there is no broker`, done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast: 267890').on(
			'connectionError',
			() => {
				called++
			}
		)

		setTimeout(async () => {
			expect(called).toBe(1)
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			done()
		}, 5000)
	})
})
