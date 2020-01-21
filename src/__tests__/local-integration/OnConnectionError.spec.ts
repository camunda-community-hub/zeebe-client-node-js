import { ZBClient } from '../..'

jest.setTimeout(30000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('onConnectionError Handler', () => {
	it(`Calls the onConnectionError handler if there is no broker`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast: 267890', {
			onConnectionError: () => {
				called++
			},
		}) // Doesn't exist!!!
		setTimeout(async () => {
			expect(called).toBe(1)
			expect(zbc2.connected).toBe(false)
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
			expect(zbc2.connected).toBe(true)
			await zbc2.close()
			done()
		}, 5000)
	})
	it(`Calls ZBClient onConnectionError once when there is no broker, and workers with no handler`, async done => {
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
	it(`Calls ZBClient onConnectionError when there no broker, for the client and each worker with a handler`, async done => {
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
	it(`Debounces onConnectionError`, async done => {
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
			expect(called).toBeLessThanOrEqual(3)
			done()
		}, 15000)
	})
	it(`Trailing parameter worker onConnectionError handler API works`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {})
		zbc2.createWorker(
			null,
			'whatever',
			(_, complete) => complete.success,
			{},
			() => {
				called++
			}
		)

		setTimeout(async () => {
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			expect(called).toBe(1)
			done()
		}, 5000)
	})
	it(`Trailing parameter worker onConnectionError handler API works`, async done => {
		let called = 0
		const zbc2 = new ZBClient('localtoast:234532534', {})
		zbc2.createWorker(
			null,
			'whatever',
			(_, complete) => complete.success,
			{
				onConnectionError: () => called--,
			},
			() => {
				called++
			}
		)

		setTimeout(async () => {
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			expect(called).toBe(1)
			done()
		}, 5000)
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
		}, 5000)
	})
})
