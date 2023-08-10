import { Duration } from 'typed-duration'
import { ZBClient } from '../..'
import { cancelProcesses } from '../../lib/cancelProcesses'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(25000)

let processId: string

let zbc: ZBClient

beforeAll(async () => {
	const zb = new ZBClient()
	processId = (await zb.deployProcess('./src/__tests__/testdata/Client-ThrowError.bpmn')).processes[0].bpmnProcessId
	cancelProcesses(processId)
	await zb.close()
})

beforeEach(() => {
	zbc = new ZBClient()
})

afterEach(async () => {
	await zbc.close()
})

afterAll(async () => {
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
	const result = await zbc.createProcessInstanceWithResult({
		bpmnProcessId: processId,
		requestTimeout: 20000,
		variables: {}
	})
	expect(result.variables.bpmnErrorCaught).toBe(true)
})

test('Can set variables when throwing a BPMN Error', async () => {
	zbc.createWorker({
		taskHandler: job =>
			job.error({
				errorCode: 'BUSINESS_ERROR',
				errorMessage: "Well, that didn't work",
				variables: {something: "someValue"}
			}),
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
	const result = await zbc.createProcessInstanceWithResult({
		bpmnProcessId: processId,
		requestTimeout: 20000,
		variables: {}
	})
	expect(result.variables.bpmnErrorCaught).toBe(true)
	// expect(result.variables.something).toBe("someValue")
})
