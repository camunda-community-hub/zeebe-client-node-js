import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
describe('ZBWorker', () => {
	let zbc: ZBClient
	let wf

	beforeEach(async () => {
		zbc = new ZBClient()
	})

	afterEach(async () => {
		try {
			if (wf?.workflowInstanceKey) {
				await zbc
					.cancelWorkflowInstance(wf.workflowInstanceKey)
					.catch(e => e)
			}
		} finally {
			await zbc.close() // Makes sure we don't forget to close connection
		}
	})

	it('Can service a task', async done => {
		const { bpmn, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
			processIdPrefix: 'service-',
			taskTypes: ['console-log'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: 'service-hello-world.bpmn',
		})

		expect(res.workflows.length).toBe(1)

		wf = await zbc.createWorkflowInstance('service-hello-world', {})
		zbc.createWorker(
			taskTypes['console-log'],
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				await complete.success(job.variables)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})

	it('Can service a task with complete.success', async done => {
		const { bpmn, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world-complete.bpmn',
			processIdPrefix: 'success-',
			taskTypes: ['console-log-complete'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: 'hello-world-complete.bpmn',
		})

		expect(res.workflows.length).toBe(1)
		wf = await zbc.createWorkflowInstance(
			'success-hello-world-complete',
			{}
		)

		zbc.createWorker(
			taskTypes['console-log-complete'],
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wf.workflowInstanceKey)
				await complete.success(job.variables)
				done()
			},
			{ loglevel: 'NONE' }
		)
	})

	it('Can update workflow variables with complete.success()', async done => {
		const { bpmn, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/conditional-pathway.bpmn',
			processIdPrefix: 'update-',
			taskTypes: ['wait', 'pathB'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: 'conditional-pathway.bpmn',
		})

		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe('update-condition-test')

		wf = await zbc.createWorkflowInstance('update-condition-test', {
			conditionVariable: true,
		})
		const wfi = wf.workflowInstanceKey
		expect(wfi).toBeTruthy()

		zbc.createWorker(
			taskTypes.wait,
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				await complete.success({
					conditionVariable: false,
				})
			},
			{ loglevel: 'NONE' }
		)

		zbc.createWorker(
			taskTypes.pathB,
			async (job, complete) => {
				expect(job.workflowInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				await complete.success(job.variables)
				wf = undefined
				done()
			},
			{ loglevel: 'NONE' }
		)
	})
})
