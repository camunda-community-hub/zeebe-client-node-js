import { ZBClient } from '../..'

jest.setTimeout(10000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('onReady/onConnectionError Handlers', () => {
	it(`Calls the onConnectionError handler if there is no broker and eagerConnection: true`, async done => {
		let called = false
		const zbc2 = new ZBClient('localtoast: 267890', {
			eagerConnection: true,
			onConnectionError: () => {
				called = true
			},
		}) // Broker doesn't exist!!!
		setTimeout(async () => {
			expect(called).toBe(true)
			await zbc2.close()
			done()
		}, 7000)
	})

	it(`Sets connected:undefined if there is no broker and no setting of eagerConnection`, async done => {
		const zbc2 = new ZBClient('localtoast: 267890') // Broker doesn't exist!!!
		setTimeout(async () => {
			expect(zbc2.connected).toBe(undefined)
			await zbc2.close()
			done()
		}, 5000)
	})

	it(`Sets connected:false if there is no broker and eagerConnection: true`, async done => {
		const zbc2 = new ZBClient('localtoast: 267890', {
			eagerConnection: true,
		}) // Broker doesn't exist!!!
		setTimeout(async () => {
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			done()
		}, 5000)
	})

	it(`Does emit the connectionError event if there is no broker and eagerConnection: true`, done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast: 267890', {
			eagerConnection: true,
		}).on('connectionError', () => {
			called++
		})

		setTimeout(async () => {
			expect(called).toBe(1)
			await zbc2.close()
			done()
		}, 7000)
	})
})
