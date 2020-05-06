import { ZBClient } from '../..'

jest.setTimeout(30000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

describe('Worker onReady Handler', () => {
	it(`Does call the onReady handler if there is a broker`, done => {
		let called = 0
		const zbc2 = new ZBClient()
		zbc2.createWorker(
			null,
			'nonsense-task',
			(_, complete) => complete.success,
			{
				onReady: () => {
					called++
				},
			}
		)
		setTimeout(async () => {
			expect(called).toBe(1)
			await zbc2.close()
			done()
		}, 6000)
	})

	it(`Does set connected: true if there is a broker and eagerConnection: true`, done => {
		const zbc2 = new ZBClient({
			eagerConnection: true,
		})
		setTimeout(async () => {
			expect(zbc2.connected).toBe(true)
			await zbc2.close()
			done()
		}, 6000)
	})

	it(`Does not set connected: true if there is a broker and eagerConnection: false`, done => {
		const zbc2 = new ZBClient()
		setTimeout(async () => {
			expect(zbc2.connected).toBe(undefined)
			await zbc2.close()
			done()
		}, 6000)
	})

	it(`Does emit the ready event if there is a broker`, done => {
		let called = 0
		const zbc2 = new ZBClient()
		zbc2.createWorker(
			'nonsense-task',
			(_, complete) => complete.success
		).on('ready', () => {
			called++
		})
		setTimeout(async () => {
			expect(called).toBe(1)
			await zbc2.close()
			done()
		}, 6000)
	})

	it(`Does not call the onReady handler if there is no broker`, done => {
		let called = 0
		const zbc2 = new ZBClient('nobroker')
		zbc2.createWorker('nonsense-task', (_, complete) => complete.success, {
			onReady: () => {
				called++
			},
		})
		setTimeout(async () => {
			expect(called).toBe(0)
			await zbc2.close()
			done()
		}, 5000)
	})

	it(`Does not emit the ready event if there is no broker`, done => {
		let called = 0
		const zbc2 = new ZBClient('nobroker')
		zbc2.createWorker({
			loglevel: 'NONE',
			taskHandler: (_, complete) => complete.success,
			taskType: 'nonsense-task',
		}).on('ready', () => {
			called++
		})
		setTimeout(async () => {
			expect(called).toBe(0)
			await zbc2.close()
			done()
		}, 5000)
	})
})
