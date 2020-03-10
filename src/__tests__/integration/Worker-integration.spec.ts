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
		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
			messages: [],
			taskTypes: ['console-log'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: `service-hello-world-${processId}.bpmn`,
		})

		expect(res.workflows.length).toBe(1)

		wf = await zbc.createWorkflowInstance(processId, {})
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
		const { bpmn, processId, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world-complete.bpmn',
			messages: [],
			taskTypes: ['console-log-complete'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: `hello-world-complete-${processId}.bpmn`,
		})

		expect(res.workflows.length).toBe(1)
		wf = await zbc.createWorkflowInstance(processId, {})

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
		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/conditional-pathway.bpmn',
			messages: [],
			taskTypes: ['wait', 'pathB'],
		})
		const res = await zbc.deployWorkflow({
			definition: bpmn,
			name: `conditional-pathway-${processId}.bpmn`,
		})

		expect(res.workflows.length).toBe(1)
		expect(res.workflows[0].bpmnProcessId).toBe(processId)

		wf = await zbc.createWorkflowInstance(processId, {
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
