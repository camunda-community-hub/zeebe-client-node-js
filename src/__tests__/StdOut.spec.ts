import { ZBClient } from '..'
import { MockStdOut } from '../lib/MockStdOut'

jest.setTimeout(15000)

test('uses an injected stdout', done => {
	const mockStd = new MockStdOut()
	const z = new ZBClient({ stdout: mockStd, eagerConnection: false })

	// tslint:disable-next-line: no-console
	z.createWorker({
		taskType: 'test',
		taskHandler: job => {
			return job.complete()
		},
	})
	setTimeout(() => {
		z.close()
	}, 2000)
	setTimeout(() => {
		expect(mockStd.messages.length > 0).toBe(true)
		done()
	}, 4000)
})
