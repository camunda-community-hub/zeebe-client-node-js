import { Loglevel, ZBClient } from '..'
const clientOptions = {
	loglevel: 'NONE' as Loglevel,
}
process.env.ZEEBE_NODE_LOG_LEVEL = 'NONE'
const previousLogLevelEnv = process.env.ZEEBE_NODE_LOG_LEVEL

beforeEach(() => {
	process.env.ZEEBE_NODE_LOG_LEVEL =
		process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
})
afterEach(() => {
	process.env.ZEEBE_NODE_LOG_LEVEL = previousLogLevelEnv
})
test('ZBClient constructor creates a new ZBClient', () => {
	const zbc = new ZBClient()
	expect(zbc instanceof ZBClient).toBe(true)
	zbc.close()
})
test('ZBClient constructor appends the port number 26500 to the gatewayAddress by default', () => {
	const zbc = new ZBClient('localhost')
	expect(zbc.gatewayAddress).toBe('localhost:26500')
	zbc.close()
})
test('ZBClient constructor accepts a custom port number for the gatewayAddress', () => {
	const zbc = new ZBClient('localhost:123')
	expect(zbc.gatewayAddress).toBe('localhost:123')
	zbc.close()
})
test('ZBClient constructor takes client options passed in Ctor when ZEEBE_NODE_LOG_LEVEL is not defined', () => {
	process.env.ZEEBE_NODE_LOG_LEVEL = ''
	clientOptions.loglevel = 'NONE'
	const z = new ZBClient(clientOptions)
	expect(z.loglevel).toBe('NONE')
	z.close()
})
test('ZEEBE_NODE_LOG_LEVEL precedes options passed in Ctor', () => {
	process.env.ZEEBE_NODE_LOG_LEVEL = 'NONE'
	clientOptions.loglevel = 'DEBUG'
	const z = new ZBClient(clientOptions)
	expect(z.loglevel).toBe('NONE')
	z.close()
})
