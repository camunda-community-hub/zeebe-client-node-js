import { cancelProcesses } from '../../lib/cancelProcesses'
import { Duration, ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
const zbc = new ZBClient()
let processId: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/hello-world.bpmn')
	processId = res.processes[0].bpmnProcessId
	await cancelProcesses(processId)
})

afterAll(async () => {
	await zbc.close() // Makes sure we don't forget to close connection
	await cancelProcesses(processId)
})

test('BatchWorker gets ten jobs', () =>
	new Promise(async done => {
		for (let i = 0; i < 10; i++) {
			await zbc.createProcessInstance({
				bpmnProcessId: processId,
				variables: {}
			})
		}

		const w = zbc.createBatchWorker({
			jobBatchMaxTime: Duration.seconds.from(120),
			jobBatchMinSize: 10,
			loglevel: 'NONE',
			taskHandler: async jobs => {
				expect(jobs.length).toBe(10)
				const res1 = await Promise.all(jobs.map(job => job.complete()))
				await w.close()
				done(null)
				return res1
			},
			taskType: 'console-log',
		})
	}))
