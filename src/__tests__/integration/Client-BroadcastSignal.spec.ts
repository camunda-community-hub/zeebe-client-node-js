import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient } from '../..'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(60000)


const zbc = new ZBClient()
let pid: string
let wf: CreateProcessInstanceResponse | undefined

beforeAll(async () => {
	const res = await zbc.deployResource({
		processFilename: `./src/__tests__/testdata/Signal.bpmn`
	})
	pid = res.deployments[0].process.bpmnProcessId
	await cancelProcesses(pid)
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey)
		}
	} catch (e: any) {
		// console.log('Caught NOT FOUND') // @DEBUG
	}
})

afterAll(async () => {
	await zbc.close()
	await cancelProcesses(pid)
})

test('Can start a process with a signal', () => new Promise(async resolve => {
		zbc.createWorker({
			taskType: 'signal-service-task',
			taskHandler: job => {
				const ack = job.complete()
				expect (job.variables.success).toBe(true)
				resolve(null)
				return ack
			}
		})
		await zbc.deployResource({
			processFilename: `./src/__tests__/testdata/Signal.bpmn`
		})
		const res = await zbc.broadcastSignal({
			signalName: 'test-signal',
			variables: {
				success: true
			}
		})
		expect(res.key).toBeTruthy()
	})
)

