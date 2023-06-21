import * as uuid from 'uuid'
import { ZBClient } from '../..'
import { cancelProcesses } from '../../lib/cancelProcesses'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(40000)

let processId: string

const zbcLongPoll = new ZBClient({
	longPoll: 60000,
})

afterAll(async () => {
	await zbcLongPoll.close()
	await cancelProcesses(processId)
})

beforeAll(async () => {
	const res = await zbcLongPoll.deployProcess('./src/__tests__/testdata/Worker-LongPoll.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

test('Does long poll by default', done => {
	const worker = zbcLongPoll.createWorker({
		taskType: uuid.v4(),
		taskHandler: job => job.complete(job.variables),
		loglevel: 'NONE',
		debug: true,
	})
	// Wait to outside 10s - it should have polled once when it gets the job
	setTimeout(async () => {
		expect(worker.pollCount).toBe(1)
		done()
	}, 30000)
})
