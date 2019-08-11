import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	const zbc = new ZBClient('0.0.0.0:26500')
	let wfi

	afterAll(async () => {
		await zbc.cancelWorkflowInstance(wfi)
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Causes a retry with complete.failure()', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-Failure.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure')

		const wf = await zbc.createWorkflowInstance('worker-failure', {
			conditionVariable: true,
		})
		wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		await zbc.createWorker(
			'test2',
			'wait-worker-failure',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				// Succeed on the third attempt
				if (job.retries === 1) {
					complete.success()
					expect(job.retries).toBe(1)
					done()
					return
				}
				complete.failure('Triggering a retry')
			}
		)
	})

	it('Does not fail a workflow when the handler throws, by default', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-Failure2.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure2')
		const wf = await zbc.createWorkflowInstance('worker-failure2', {})
		const testWorkflowInstanceExists = () => {
			setTimeout(async () => {
				try {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. Should NOT throw in this test
				} catch (e) {
					throw e
				}
				done()
			}, 1000)
		}
		let alreadyFailed = false
		// Faulty worker
		zbc.createWorker('test', 'console-log-worker-failure-2', () => {
			if (alreadyFailed) {
				return
			}
			alreadyFailed = true
			testWorkflowInstanceExists() // waits 700ms then checks
			throw new Error(
				'Unhandled exception in task handler for testing purposes'
			) // Will be caught in the library
		})
	})

	it('Fails a workflow when the handler throws and options.failWorkflowOnException is set', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-Failure2.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure2')
		const wf = await zbc.createWorkflowInstance('worker-failure2', {})
		const testWorkflowInstanceExists = () => {
			setTimeout(async () => {
				try {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. SHOULD throw in this test
				} catch (e) {
					done()
				}
			}, 1500)
		}
		let alreadyFailed = false
		// Faulty worker
		zbc.createWorker(
			'test',
			'console-log-worker-failure-2',
			() => {
				if (alreadyFailed) {
					// It polls 10 times a second, and we need it to only throw once
					return
				}
				alreadyFailed = true
				testWorkflowInstanceExists() // waits 1000ms then checks
				throw new Error(
					'Unhandled exception in task handler for test purposes'
				) // Will be caught in the library
			},
			{
				failWorkflowOnException: true,
			}
		)
	})
})
