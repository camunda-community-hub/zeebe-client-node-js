import { ZBClient } from '../..'

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	let zbc: ZBClient

	beforeEach(async () => {
		zbc = new ZBClient('0.0.0.0:26500')
	})

	afterEach(async () => {
		await zbc.close() // Makes sure we don't forget to close connection
	})

	it('Can service a task', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)

		const wf = await zbc.createWorkflowInstance('hello-world', {})
		zbc.createWorker('test', 'console-log', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
			complete(job.variables)
			done()
		})
	})

	it('Can service a task with complete.success', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		const wf = await zbc.createWorkflowInstance('hello-world', {})
		zbc.createWorker('test', 'console-log', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
			complete.success(job.variables)
			zbc.cancelWorkflowInstance(wf.workflowInstanceKey)
			done()
		})
	})

	it('Does not fail a workflow when the handler throws, by default', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
		const wf = await zbc.createWorkflowInstance('hello-world', {})
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
		zbc.createWorker('test', 'console-log', () => {
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
			'./src/__tests__/testdata/hello-world.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
		const wf = await zbc.createWorkflowInstance('hello-world', {})
		const testWorkflowInstanceExists = () => {
			setTimeout(async () => {
				try {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. SHOULD throw in this test
				} catch (e) {
					done()
				}
			}, 1000)
		}
		let alreadyFailed = false
		// Faulty worker
		zbc.createWorker(
			'test',
			'console-log',
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

	it('Can update workflow variables with complete.success()', async done => {
		const res = await zbc.deployWorkflow(
			'./src/__tests__/testdata/conditional-pathway.bpmn'
		)
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('condition-test')

		const wf = await zbc.createWorkflowInstance('condition-test', {
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

		zbc.createWorker('test2', 'wait', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			complete.success(job)
		})

		zbc.createWorker('test2', 'pathB', async (job, complete) => {
			expect(job.workflowInstanceKey).toBe(wfi)
			expect(job.variables.conditionVariable).toBe(false)
			complete.success(job.variables)
			await zbc.cancelWorkflowInstance(wf.workflowInstanceKey)
			done()
		})
	})
})
