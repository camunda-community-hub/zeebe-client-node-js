import { ZBClient, ZBWorkerTaskHandler } from '../../index'

describe('Types API', () => {
	it("Hasn't broken any public type contracts", async done => {
		const zbc = new ZBClient()
		const handler: ZBWorkerTaskHandler = (job, complete, worker) => {
			worker.log(job.bpmnProcessId)
			complete.success()
		}
		zbc.createWorker('nope', handler)
		await zbc.close()
		expect(true).toBeTruthy()
		done()
	})
})
