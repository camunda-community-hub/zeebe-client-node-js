import { ZBClient } from '../..'
jest.unmock('node-grpc-client')

process.env.ZB_NODE_LOG_LEVEL = process.env.ZB_NODE_LOG_LEVEL || 'NONE'

describe('ZBWorker', () => {
	it('Does not fail a workflow when the handler throws, by default', async done => {
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
		const wf = await zbc.createWorkflowInstance('hello-world', {})
		const testWorkflowInstanceExists = () => {
			setTimeout(async () => {
				try {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. Should NOT throw in this test
				} catch (e) {
					zbc.close()
					throw e
				}
				zbc.close()
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
		const zbc = new ZBClient('0.0.0.0:26500')

		const res = await zbc.deployWorkflow('./test/hello-world.bpmn')
		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('hello-world')
		const wf = await zbc.createWorkflowInstance('hello-world', {})
		const testWorkflowInstanceExists = () => {
			setTimeout(async () => {
				try {
					await zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // throws if not found. SHOULD throw in this test
				} catch (e) {
					zbc.close()
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
				testWorkflowInstanceExists() // waits 700ms then checks
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
