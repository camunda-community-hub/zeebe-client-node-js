import { Loglevel, ZBClient } from '..'
const clientOptions = {
	loglevel: 'NONE' as Loglevel,
}
process.env.ZEEBE_NODE_LOG_LEVEL = 'NONE'
let previousLogLevelEnv

describe('ZBClient constructor', () => {
	beforeEach(() => {
		process.env.ZEEBE_NODE_LOG_LEVEL =
			process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
	})
	beforeAll(() => {
		previousLogLevelEnv = process.env.ZEEBE_NODE_LOG_LEVEL
	})
	afterAll(() => {
		process.env.ZEEBE_NODE_LOG_LEVEL = previousLogLevelEnv
	})
	it('creates a new ZBClient', () => {
		const zbc = new ZBClient()
		expect(zbc instanceof ZBClient).toBe(true)
		zbc.close()
	})
	it('appends the port number 26500 to the gatewayAddress by default', () => {
		const zbc = new ZBClient()
		expect(zbc.gatewayAddress).toBe('localhost:26500')
		zbc.close()
	})
	it('accepts a custom port number for the gatewayAddress', () => {
		const zbc = new ZBClient('localhost:123')
		expect(zbc.gatewayAddress).toBe('localhost:123')
		zbc.close()
	})
	it('takes client options passed in Ctor when ZEEBE_NODE_LOG_LEVEL is not defined', () => {
		process.env.ZEEBE_NODE_LOG_LEVEL = ''
		clientOptions.loglevel = 'NONE'
		const z = new ZBClient(clientOptions)
		expect(z.loglevel).toBe('NONE')
		z.close()
	})
	it('ZEEBE_NODE_LOG_LEVEL precedes options passed in Ctor', () => {
		process.env.ZEEBE_NODE_LOG_LEVEL = 'NONE'
		clientOptions.loglevel = 'DEBUG'
		const z = new ZBClient(clientOptions)
		expect(z.loglevel).toBe('NONE')
		z.close()
	})
})
