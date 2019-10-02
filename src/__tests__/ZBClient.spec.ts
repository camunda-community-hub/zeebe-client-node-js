import { Loglevel, ZBClient } from '..'
const clientOptions = {
	loglevel: 'NONE' as Loglevel,
}
process.env.ZB_NODE_LOG_LEVEL = 'NONE'
let previousLogLevelEnv

describe('ZBClient constructor', () => {
	beforeEach(() => {
		process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'
	})
	beforeAll(() => {
		previousLogLevelEnv = process.env.ZB_NODE_LOG_LEVEL
	})
	afterAll(() => {
		process.env.ZB_NODE_LOG_LEVEL = previousLogLevelEnv
	})
	it('creates a new ZBClient', () => {
		const zbc = new ZBClient()
		expect(zbc instanceof ZBClient).toBe(true)
	})
	it('appends the port number 26500 to the gatewayAddress by default', () => {
		const zbc = new ZBClient()
		expect(zbc.gatewayAddress).toBe('localhost:26500')
	})
	it('accepts a custom port number for the gatewayAddress', () => {
		const zbc = new ZBClient('localhost:123')
		expect(zbc.gatewayAddress).toBe('localhost:123')
	})
	it('takes client options passed in Ctor when ZB_NODE_LOG_LEVEL is not defined', () => {
		process.env.ZB_NODE_LOG_LEVEL = ''
		clientOptions.loglevel = 'DEBUG'
		const z = new ZBClient(clientOptions)
		expect(z.loglevel).toBe('DEBUG')
	})
	it('ZB_NODE_LOG_LEVEL precedes options passed in Ctor', () => {
		process.env.ZB_NODE_LOG_LEVEL = 'INFO'
		clientOptions.loglevel = 'DEBUG'
		const z = new ZBClient(clientOptions)
		expect(z.loglevel).toBe('INFO')
	})
})
