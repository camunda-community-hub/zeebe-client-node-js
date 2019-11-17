import { ZBClient } from '..'
import { MockStdOut } from '../lib/MockStdOut'

jest.setTimeout(15000)

describe('StdOut Substitution', () => {
	it('uses an injected stdout', done => {
		const mockStd = new MockStdOut()
		const z = new ZBClient({ stdout: mockStd })

		// tslint:disable-next-line: no-console
		z.createWorker(null, 'test', console.log)
		setTimeout(() => {
			z.close()
		}, 2000)
		setTimeout(() => {
			expect(mockStd.messages.length > 0).toBe(true)
			done()
		}, 4000)
	})
})
