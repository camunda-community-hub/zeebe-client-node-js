import { ZBClient } from '../..'

jest.setTimeout(30000)
process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('onConnectionError Handler', () => {
	it(`Calls the onConnectionError handler if there is no broker`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast: 267890', {
			onConnectionError: () => {
				called++
			},
		}) // Doesn't exist!!!
		setTimeout(() => {
			expect(called).toBe(1)
			expect(zbc2.connected).toBe(false)
			zbc2.close()
			done()
		}, 4000)
	})

	it(`Does not call the onConnectionError handler if there is a broker`, async done => {
		let called = 0
		const zbc2 = new ZBClient({
			onConnectionError: () => {
				called++
			},
		})
		setTimeout(() => {
			expect(called).toBe(0)
			expect(zbc2.connected).toBe(true)
			zbc2.close()
			done()
		}, 4000)
	})
	it(`Calls ZBClient onConnectionError once when there is no broker, and workers`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {
			onConnectionError: () => {
				called++
			},
		})
		zbc2.createWorker(null, 'whatever', (_, complete) => complete.success)
		zbc2.createWorker(null, 'whatever', (_, complete) => complete.success)
		setTimeout(() => {
			expect(zbc2.connected).toBe(false)
			zbc2.close()
			expect(called).toBe(1)
			done()
		}, 6000)
	})
	it(`Calls ZBClient onConnectionError once each, when there is a worker, and no broker`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {
			onConnectionError: () => {
				called++
			},
		})
		zbc2.createWorker(null, 'whatever', (_, complete) => complete.success, {
			onConnectionError: () => called++,
		})
		setTimeout(() => {
			expect(zbc2.connected).toBe(false)
			zbc2.close()
			expect(called).toBe(2)
			done()
		}, 6000)
	})
})
