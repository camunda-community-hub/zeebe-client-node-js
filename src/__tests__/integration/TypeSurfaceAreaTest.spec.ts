import { ZBClient, ZBWorkerTaskHandler } from '../../index'

describe('Types API', () => {
	it("Hasn't broken any public type contracts", () => {
		const zbc = new ZBClient()
		const handler: ZBWorkerTaskHandler = (job, complete, worker) => {
			worker.log(job.bpmnProcessId)
			complete.success()
		}

		expect(true).toBeTruthy()
	})
})
