import { ZBClient } from '../../..'
import { createUniqueTaskType } from '../../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
let zbc: ZBClient
let wf: CreateProcessInstanceResponse | undefined

beforeEach(async () => {
	// tslint:disable-next-line: no-console
	// console.log('Creating client...') // @DEBUG
	zbc = new ZBClient()
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey).catch(e => e)
		}
	} finally {
		await zbc.close() // Makes sure we don't forget to close connection
	}
})

test('Can retrieve only specified variables using fetchVariable', () =>
	new Promise(async done => {
		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
			messages: [],
			taskTypes: ['console-log'],
		})

		const res = await zbc.deployProcess({
			definition: bpmn,
			name: `service-hello-world-${processId}.bpmn`,
		})

		expect(res.processes.length).toBe(1)

		wf = await zbc.createProcessInstance(processId, {
			var1: 'foo',
			var2: 'bar',
		})

		zbc.createWorker({
			fetchVariable: ['var2'],
			taskType: taskTypes['console-log'],
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wf?.processInstanceKey)
				expect(job.variables.var2).toEqual('bar')
				expect((job.variables as any).var1).not.toBeDefined()
				const res1 = await job.complete(job.variables)
				done(null)
				return res1
			},
			loglevel: 'NONE',
		})
	}))
