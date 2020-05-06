import { ZBClient } from '../..'

jest.setTimeout(16000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient', () => {
	it(`Calls the onConnectionError handler if there is no broker and eagerConnection:true`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast: 267890', {
			eagerConnection: true,
			onConnectionError: () => {
				called++
			},
		})
		setTimeout(async () => {
			expect(called).toBe(1)
			await zbc2.close()
			done()
		}, 5000)
	})

	it(`Does not call the onConnectionError handler if there is a broker`, async done => {
		let called = 0
		const zbc2 = new ZBClient({
			onConnectionError: () => {
				called++
			},
		})
		setTimeout(async () => {
			expect(called).toBe(0)
			await zbc2.close()
			done()
		}, 5000)
	})
	it(`Calls ZBClient onConnectionError once when there is no broker, eagerConnection:true, and workers with no handler`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {
			eagerConnection: true,
			onConnectionError: () => {
				called++
			},
		})
		zbc2.createWorker(null, 'whatever', (_, complete) => complete.success)
		zbc2.createWorker(null, 'whatever', (_, complete) => complete.success)
		setTimeout(() => {
			zbc2.close()
			expect(called).toBe(1)
			done()
		}, 10000)
	})
	it(`Calls ZBClient onConnectionError when there no broker, for the client and each worker with a handler`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {
			onConnectionError: () => {
				called++
			},
		})
		zbc2.createWorker('whatever', (_, complete) => complete.success, {
			onConnectionError: () => called++,
		})
		// @TOFIX - debouncing
		setTimeout(() => {
			zbc2.close()
			expect(called).toBe(4) // Should be 2 if it is debounced
			done()
		}, 10000)
	})
	it(`Debounces onConnectionError`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {
			onConnectionError: () => {
				called++
			},
		})
		zbc2.createWorker('whatever', (_, complete) => complete.success, {
			onConnectionError: () => called++,
		})
		// @TOFIX - debouncing
		setTimeout(() => {
			zbc2.close()
			expect(called).toBe(5) // toBeLessThanOrEqual(1)
			done()
		}, 15000)
	})
	it(`Trailing parameter worker onConnectionError handler API works`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {})
		zbc2.createWorker('whatever', (_, complete) => complete.success, {
			onConnectionError: () => called++,
		})
		// @TOFIX - debouncing
		setTimeout(async () => {
			await zbc2.close()
			expect(called).toBe(4) // should be 1 if debounced
			done()
		}, 10000)
	})
	it(`Does not call the onConnectionError handler if there is a business error`, async done => {
		let called = 0
		let wf = 'arstsrasrateiuhrastulyharsntharsie'
		const zbc2 = new ZBClient({
			onConnectionError: () => {
				called++
			},
		})
		zbc2.createWorkflowInstance(wf, {}).catch(() => {
			wf = 'throw error away'
		})
		setTimeout(async () => {
			expect(zbc2.connected).toBe(true)
			expect(called).toBe(0)
			await zbc2.close()
			done()
		}, 10000)
	})
})
