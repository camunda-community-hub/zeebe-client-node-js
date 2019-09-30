import { ZBClient } from '../..'

jest.setTimeout(15000)
process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'DEBUG'

describe('onReady Handler', () => {
	// let zbc: ZBClient

	// beforeEach(async () => {
	// 	zbc = new ZBClient()
	// })

	// afterEach(async () => {
	// 	await zbc.close() // Makes sure we don't forget to close connection
	// })

	it(`Doesn't call the onReady handler if there is no broker`, async done => {
		let called = false
		const zbc2 = new ZBClient('localtoast: 267890', {
			onReady: () => {
				called = true
			},
		}) // Doesn't exist!!!
		setTimeout(() => {
			expect(called).toBe(false)
			expect(zbc2.connected).toBe(false)
			zbc2.close()
			done()
		}, 4000)
	})

	it(`Does call the onReady handler if there is a broker`, done => {
		let called = false
		const zbc2 = new ZBClient('localhost', {
			onReady: () => {
				called = true
			},
		})

		setTimeout(() => {
			expect(called).toBe(true)
			expect(zbc2.connected).toBe(true)
			zbc2.close()
			done()
		}, 4000)
	})

	it(`Calls the onConnectionError handler if there is no broker`, async done => {
		let called = false
		const zbc2 = new ZBClient('localtoast: 267890', {
			onConnectionError: () => {
				called = true
			},
		}) // Doesn't exist!!!
		setTimeout(() => {
			expect(called).toBe(true)
			expect(zbc2.connected).toBe(false)
			zbc2.close()
			done()
		}, 4000)
	})

	it(`Does not call the onConnectionError handler if there is a broker`, async done => {
		let called = false
		const zbc2 = new ZBClient({
			onConnectionError: () => {
				called = true
			},
		}) // Doesn't exist!!!
		setTimeout(() => {
			expect(called).toBe(false)
			expect(zbc2.connected).toBe(true)
			zbc2.close()
			done()
		}, 4000)
	})
})
