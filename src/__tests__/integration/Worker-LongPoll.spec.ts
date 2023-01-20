import * as uuid from 'uuid'
import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(40000)

const zbcLongPoll = new ZBClient({
	longPoll: 60000,
})

afterAll(async () => {
	await zbcLongPoll.close()
})

beforeAll(async () => {
	const { processId, bpmn } = createUniqueTaskType({
		bpmnFilePath: './src/__tests__/testdata/Worker-LongPoll.bpmn',
		messages: [],
		taskTypes: [],
	})
	await zbcLongPoll.deployProcess({
		definition: bpmn,
		name: `worker-longPoll-${processId}.bpmn`,
	})
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
	}, 35000)
})
