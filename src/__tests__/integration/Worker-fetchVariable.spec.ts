import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../..'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
const zbc= new ZBClient()
let wf: CreateProcessInstanceResponse | undefined
let processId: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/hello-world.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey).catch(e => e)
		}
	} catch {

	}
})

afterAll(async () => {
	await cancelProcesses(processId)
	await zbc.close()
})

test('Can retrieve only specified variables using fetchVariable', () =>
	new Promise(async done => {
		wf = await zbc.createProcessInstance({
			bpmnProcessId: processId,
			variables: {
			var1: 'foo',
			var2: 'bar'
			}
		})

		zbc.createWorker({
			fetchVariable: ['var2'],
			taskType: 'console-log',
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
