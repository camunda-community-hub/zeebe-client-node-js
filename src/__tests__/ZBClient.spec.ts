import { ZBClient } from '..'
import { clientOptions } from '../__mocks__/zbClientOptions'

describe('ZBClient constructor', () => {
	beforeEach(() => {
		process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'
	})
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
	it('takes client options passed in Ctor when ZB_NODE_LOG_LEVEL is not defined', () => {
		process.env.ZB_NODE_LOG_LEVEL = ''
		clientOptions.loglevel = 'DEBUG'
		const spy = jest.spyOn(clientOptions, 'loglevel', 'get')
		expect(new ZBClient('localhost', clientOptions)).toBeInstanceOf(
			ZBClient
		)
		expect(spy).toHaveBeenCalled()
		spy.mockRestore()
	})
	it('ZB_NODE_LOG_LEVEL precedes options passed in Ctor', () => {
		clientOptions.loglevel = 'DEBUG'
		const spy = jest.spyOn(clientOptions, 'loglevel', 'get')
		expect(new ZBClient('localhost', clientOptions)).toBeInstanceOf(
			ZBClient
		)
		expect(spy).toBeCalledTimes(0)
		spy.mockRestore()
	})
})
