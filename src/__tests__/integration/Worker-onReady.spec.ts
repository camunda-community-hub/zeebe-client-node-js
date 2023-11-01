import { ZBClient } from '../..'

jest.setTimeout(40000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

test(`Worker emits the ready event once if there is a broker`, done => {
	let called = 0
	const zbc2 = new ZBClient()
	zbc2.createWorker({
		taskHandler: job => job.complete(),
		taskType: 'nonsense-task',
	}).on('ready', () => {
		called++
	})
	setTimeout(async () => {
		expect(called).toBe(1)
		await zbc2.close()
		done()
	}, 12000)
})

test(`Does set connected: true if there is a broker and eagerConnection: true`, done => {
	const zbc2 = new ZBClient({
		eagerConnection: true,
	})
	setTimeout(async () => {
		expect(zbc2.connected).toBe(true)
		await zbc2.close()
		done()
	}, 7000)
})

test(`Does not set connected: true if there is a broker and eagerConnection: false`, done => {
	const zbc2 = new ZBClient()
	setTimeout(async () => {
		expect(zbc2.connected).toBe(false)
		await zbc2.close()
		done()
	}, 7000)
})

test(`Does not call the onReady handler if there is no broker`, done => {
	let called = 0
	const zbc2 = new ZBClient('nobroker')
	zbc2.createWorker({
		onReady: () => {
			called++
		},
		taskHandler: job => job.complete(),
		taskType: 'nonsense-task',
	})
	setTimeout(async () => {
		expect(called).toBe(0)
		await zbc2.close()
		done()
	}, 5000)
})

test(`Does not emit the ready event if there is no broker`, done => {
	let called = 0
	const zbc2 = new ZBClient('nobroker')
	zbc2.createWorker({
		loglevel: 'NONE',
		taskHandler: job => job.complete(),
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

test(`Worker calls the onReady handler once if there is a broker`, done => {
	let called = 0
	const zbc2 = new ZBClient()
	zbc2.createWorker({
		onReady: () => {
			called++
		},
		taskHandler: job => job.complete(),
		taskType: 'nonsense-task',
	})
	setTimeout(async () => {
		expect(called).toBe(1)
		await zbc2.close()
		done()
	}, 12000)
})
