import { ZBClient } from '../..'

jest.setTimeout(10000)
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
			expect(zbc2.connected).toBe(true)
			await zbc2.close()
			done()
		}, 4000)
	})

	it(`Does emit the ready event if there is a broker`, done => {
		let called = 0
		const zbc2 = new ZBClient()
		zbc2.createWorker(
			null,
			'nonsense-task',
			(_, complete) => complete.success
		).on('ready', () => {
			called++
		})
		setTimeout(async () => {
			expect(called).toBe(1)
			expect(zbc2.connected).toBe(true)
			await zbc2.close()
			done()
		}, 4000)
	})

	it(`Does not call the onReady handler if there is no broker`, done => {
		let called = 0
		const zbc2 = new ZBClient('nobroker')
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
			expect(called).toBe(0)
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			done()
		}, 4000)
	})

	it(`Does not emit the ready event if there is no broker`, done => {
		let called = 0
		const zbc2 = new ZBClient('nobroker')
		zbc2.createWorker(
			null,
			'nonsense-task',
			(_, complete) => complete.success
		).on('ready', () => {
			called++
		})
		setTimeout(async () => {
			expect(called).toBe(0)
			expect(zbc2.connected).toBe(false)
			await zbc2.close()
			done()
		}, 4000)
	})
})
