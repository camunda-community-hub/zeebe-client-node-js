import { ZBClient } from '../..'

jest.setTimeout(10000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('onReady Handler', () => {
	it(`Doesn't call the onReady handler if there is no broker`, async done => {
		let called = false
		const zbc2 = new ZBClient('localtoast: 267890', {
			onReady: () => {
				called = true
			},
		}) // Broker doesn't exist!!!
		setTimeout(async () => {
			expect(called).toBe(false)
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			done()
		}, 4000)
	})

	it(`Does call the onReady handler if there is a broker`, done => {
		let called = 0
		const zbc2 = new ZBClient({
			onReady: () => {
				called++
			},
		})

		setTimeout(async () => {
			expect(called).toBe(1)
			expect(zbc2.connected).toBe(true)
			await zbc2.close()
			done()
		}, 4000)
	})

	it(`Does emit the ready event if there is a broker`, done => {
		let called = 0
		const zbc2 = new ZBClient().on('ready', () => {
			called++
		})

		setTimeout(async () => {
			expect(called).toBe(1)
			expect(zbc2.connected).toBe(true)
			await zbc2.close()
			done()
		}, 4000)
	})
})
