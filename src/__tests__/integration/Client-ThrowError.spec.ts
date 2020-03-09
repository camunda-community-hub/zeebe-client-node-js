import { Duration } from 'typed-duration'
import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(25000)

describe('ZBClient.throwError', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient()
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Throws a business error that is caught in the process', async () => {
		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/Client-ThrowError.bpmn',
			messages: [],
			taskTypes: ['throw-bpmn-error-task', 'sad-flow'],
		})

		await zbc.deployWorkflow({
			definition: bpmn,
			name: `error-throw-bpmn-error-${processId}.bpmn`,
		})
		zbc.createWorker({
			taskHandler: (_, complete) =>
				complete.error('BUSINESS_ERROR', "Well, that didn't work"),
			taskType: taskTypes['throw-bpmn-error-task'],
			timeout: Duration.seconds.of(30),
		})
		zbc.createWorker(taskTypes['sad-flow'], (_, complete) =>
			complete.success({
				bpmnErrorCaught: true,
			})
		)
		const result = await zbc.createWorkflowInstanceWithResult(processId, {
			timeout: 20000,
		})
		expect(result.variables.bpmnErrorCaught).toBe(true)
	})
})
