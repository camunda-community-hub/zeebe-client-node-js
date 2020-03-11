import { ZBClient } from '../..'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)

const trace = async result => {
	// tslint:disable-next-line: no-console
	// console.log(result)
	return result
}

describe('ZBClient', () => {
	let zbc: ZBClient
	let wf

	beforeEach(async () => {
		zbc = new ZBClient()
	})

	afterEach(async done => {
		try {
			if (wf?.workflowInstanceKey) {
				zbc.cancelWorkflowInstance(wf.workflowInstanceKey) // Cleanup any active workflows
			}
		} finally {
			await zbc.close() // Makes sure we don't forget to close connection
			done()
		}
	})

	it('Can update workflow variables with setVariables', async done => {
		jest.setTimeout(30000)

		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/conditional-pathway.bpmn',
			messages: [],
			taskTypes: ['pathB', 'wait'],
		})

		const res = await zbc
			.deployWorkflow({
				definition: bpmn,
				name: `conditional-pathway-${processId}.bpmn`,
			})
			.then(trace)

		expect(res?.workflows?.length).toBe(1)
		expect(res?.workflows?.[0]?.bpmnProcessId).toBe(processId)

		wf = await zbc
			.createWorkflowInstance(processId, {
				conditionVariable: true,
			})
			.then(trace)

		const wfi = wf?.workflowInstanceKey
		expect(wfi).toBeTruthy()

		zbc.setVariables({
			elementInstanceKey: wfi,
			local: false,
			variables: {
				conditionVariable: false,
			},
		}).then(trace)
		trace('Creating wait worker')
		zbc.createWorker(
			taskTypes.wait,
			async (job, complete) => {
				expect(job?.workflowInstanceKey).toBe(wfi)
				trace(`Completing wait job for ${job.workflowInstanceKey}`)
				complete.success(job)
			},
			{ loglevel: 'INFO' }
		)

		zbc.createWorker(
			taskTypes.pathB,
			async (job, complete) => {
				expect(job?.workflowInstanceKey).toBe(wfi)
				expect(job?.variables?.conditionVariable).toBe(false)
				complete.success(job.variables)
				done()
			},
			{ loglevel: 'INFO' }
		)
	})
})
