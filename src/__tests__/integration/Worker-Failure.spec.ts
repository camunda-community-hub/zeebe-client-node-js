import { ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('ZBWorker', () => {
	let zbc: ZBClient
	let wf

	beforeEach(() => {
		zbc = new ZBClient(gatewayAddress)
	})

	afterEach(async done => {
		try {
			if (wf) {
				await zbc.cancelWorkflowInstance(wf.workflowInstanceKey)
			}
		} catch (e) {
			// console.log('Caught NOT FOUND') // @DEBUG
		} finally {
			await zbc.close() // Makes sure we don't forget to close connection
			done()
		}
	})

	it('Causes a retry with complete.failure()', async done => {
		jest.setTimeout(30000)
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-Failure1.bpmn'
		)

		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure')

		wf = await zbc.createWorkflowInstance('worker-failure', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		await zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		})

		const w = zbc.createWorker(
			'test2',
			'wait-worker-failure',
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				// Succeed on the third attempt
				if (job.retries === 1) {
					complete.success()
					expect(job.retries).toBe(1)
					return w.close().then(() => done())
				}
				complete.failure('Triggering a retry')
			},
			{ loglevel: 'NONE' }
		)
	})

	it('Does not fail a workflow when the handler throws, by default', async done => {
		jest.setTimeout(17000)

		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-Failure2.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure2')
		wf = await zbc.createWorkflowInstance('worker-failure2', {})

		let alreadyFailed = false

		// Faulty worker - throws an unhandled exception in task handler
		const w = zbc.createWorker(
			'test',
			'console-log-worker-failure-2',
			async (_, complete) => {
				if (alreadyFailed) {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. Should NOT throw in this test
					complete.success()
					return w.close().then(() => done())
				}
				alreadyFailed = true
				throw new Error(
					'Unhandled exception in task handler for testing purposes'
				) // Will be caught in the library
			},
			{
				loglevel: 'NONE',
				pollInterval: 10000,
			}
		)
	})

	it('Fails a workflow when the handler throws and options.failWorkflowOnException is set', async done => {
		jest.setTimeout(10000)

		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/Worker-Failure3.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('worker-failure3')
		wf = await zbc.createWorkflowInstance('worker-failure3', {})

		let alreadyFailed = false
		// Faulty worker
		const w = zbc.createWorker(
			'test',
			'console-log-worker-failure-3',
			() => {
				if (alreadyFailed) {
					// It polls multiple times a second, and we need it to only throw once
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
				loglevel: 'NONE',
			}
		)

		function testWorkflowInstanceExists() {
			setTimeout(async () => {
				try {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. SHOULD throw in this test
				} catch (e) {
					w.close().then(() => done())
				}
			}, 1500)
		}
	})
})
