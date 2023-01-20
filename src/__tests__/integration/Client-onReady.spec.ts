import { ZBClient } from '../..'

jest.setTimeout(30000)
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

test(`Doesn't call the onReady handler if there is no broker`, () =>
	new Promise(async done => {
		let called = false
		const zbc2 = new ZBClient('localtoast: 267890', {
			onReady: () => {
				called = true
			},
		}) // Broker doesn't exist!!!
		setTimeout(async () => {
			expect(called).toBe(false)
			await zbc2.close()
			done(null)
		}, 4000)
	}))

test(`Does call the onReady handler if there is a broker and eagerConnection is true`, done => {
	let called = 0
	const zbc2 = new ZBClient({
		eagerConnection: true,
		onReady: () => {
			called++
		},
	})

	setTimeout(async () => {
		expect(called).toBe(1)
		await zbc2.close()
		done()
	}, 6000)
})

test(`Does set connected to true if there is a broker`, done => {
	const zbc2 = new ZBClient({
		eagerConnection: true,
	})

	setTimeout(async () => {
		expect(zbc2.connected).toBe(true)
		await zbc2.close()
		done()
	}, 6000)
})

test(`Does emit the ready event if there is a broker and eagerConnection: true`, done => {
	let called = 0
	const zbc2 = new ZBClient({ eagerConnection: true })
	zbc2.on('ready', () => {
		called++
	})

	setTimeout(async () => {
		expect(called).toBe(1)
		expect(zbc2.connected).toBe(true)
		await zbc2.close()
		done()
	}, 6000)
})
