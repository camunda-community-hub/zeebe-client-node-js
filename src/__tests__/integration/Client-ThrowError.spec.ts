import { Duration } from 'typed-duration'
import { ZBClient } from '../..'
import { cancelProcesses } from '../ lib/cancelProcesses'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(25000)

let processId: string

const zbc = new ZBClient()

beforeAll(async () => {
	processId = (await zbc.deployProcess('./src/__tests__/testdata/Client-ThrowError.bpmn')).processes[0].bpmnProcessId
	cancelProcesses(processId)
})

afterAll(async () => {
	await zbc.close()
	cancelProcesses(processId)
})

test('Throws a business error that is caught in the process', async () => {
	zbc.createWorker({
		taskHandler: job =>
			job.error('BUSINESS_ERROR', "Well, that didn't work"),
		taskType: 'throw-bpmn-error-task',
		timeout: Duration.seconds.of(30),
	})
	zbc.createWorker({
		taskType: 'sad-flow',
		taskHandler: job =>
			job.complete({
				bpmnErrorCaught: true,
			}),
	})
	const result = await zbc.createProcessInstanceWithResult(processId, {
		timeout: 20000,
	})
	expect(result.variables.bpmnErrorCaught).toBe(true)
})
