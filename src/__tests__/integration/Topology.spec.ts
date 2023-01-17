import { ZBClient } from '../..'

const zbc = new ZBClient({
	eagerConnection: false,
})

test('it can get the topology', async () => {
	const res = await zbc.topology()
	expect(Array.isArray(res?.brokers)).toBe(true)
	await zbc.close()
})
