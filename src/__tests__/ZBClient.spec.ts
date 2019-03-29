import { ZBClient } from '..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBClient constructor', () => {
	it('creates a new ZBClient', () => {
		const zbc = new ZBClient('localhost')
		expect(zbc instanceof ZBClient).toBe(true)
	})
	it('appends the port number 26500 to the brokerAddress by default', () => {
		const zbc = new ZBClient('localhost')
		expect(zbc.brokerAddress).toBe('localhost:26500')
	})
	it('accepts a custom port number for the brokerAddress', () => {
		const zbc = new ZBClient('localhost:123')
		expect(zbc.brokerAddress).toBe('localhost:123')
	})
	it('throws an exception when not provided a brokerAddress in the constructor', () => {
		expect(() => new (ZBClient as any)()()).toThrow()
	})
})
