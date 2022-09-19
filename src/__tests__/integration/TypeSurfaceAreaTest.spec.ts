import { ZBClient, ZBWorkerTaskHandler } from '../../index'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

jest.setTimeout(7000)

test("Hasn't broken any public type contracts", async () => {
	const zbc = new ZBClient({
		loglevel: 'NONE',
	})
	const handler: ZBWorkerTaskHandler = (job, worker) => {
		worker.log(job.bpmnProcessId)
		return job.complete()
	}
	zbc.createWorker({ taskType: 'nope', taskHandler: handler })
	await zbc.close()
	expect(true).toBeTruthy()
})
