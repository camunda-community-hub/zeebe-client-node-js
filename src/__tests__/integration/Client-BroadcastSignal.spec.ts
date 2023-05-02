import { ZBClient } from '../..'
// import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(60000)


let zbc: ZBClient
let wf: CreateProcessInstanceResponse | undefined

beforeEach(() => {
	zbc = new ZBClient()
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey)
		}
	} catch (e: any) {
		// console.log('Caught NOT FOUND') // @DEBUG
	} finally {
		await zbc.close() // Makes sure we don't forget to close connection
	}
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

