import { ZBClient } from '../../..'
import { createUniqueTaskType } from '../../../lib/createUniqueTaskType'
import { CreateProcessInstanceResponse } from '../../../lib/interfaces-grpc-1.0'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(30000)
let zbc: ZBClient
let wf: CreateProcessInstanceResponse | undefined

beforeEach(async () => {
	// tslint:disable-next-line: no-console
	// console.log('Creating client...') // @DEBUG

	zbc = new ZBClient()
})

afterEach(async () => {
	try {
		if (wf?.processInstanceKey) {
			await zbc.cancelProcessInstance(wf.processInstanceKey).catch(e => e)
		}
	} finally {
		await zbc.close() // Makes sure we don't forget to close connection
	}
})

test('Can service a task', () =>
	new Promise(async done => {
		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world.bpmn',
			messages: [],
			taskTypes: ['console-log'],
		})
		const res = await zbc.deployProcess({
			definition: bpmn,
			name: `service-hello-world-${processId}.bpmn`,
		})

		expect(res.processes.length).toBe(1)

		// tslint:disable-next-line: no-console
		// console.log('Creating process instance...') // @DEBUG
		wf = await zbc.createProcessInstance(processId, {})
		// tslint:disable-next-line: no-console
		// console.log('Creating worker...') // @DEBUG

		zbc.createWorker({
			taskType: taskTypes['console-log'],
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wf?.processInstanceKey)
				const res1 = await job.complete(job.variables)
				done(null)
				return res1
			},
			loglevel: 'NONE',
		})
	}))

test('Can service a task with complete.success', () =>
	new Promise(async done => {
		const { bpmn, processId, taskTypes } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/hello-world-complete.bpmn',
			messages: [],
			taskTypes: ['console-log-complete'],
		})
		const res = await zbc.deployProcess({
			definition: bpmn,
			name: `hello-world-complete-${processId}.bpmn`,
		})

		expect(res.processes.length).toBe(1)
		// tslint:disable-next-line: no-console
		// console.log('Creating process instance...') // @DEBUG
		wf = await zbc.createProcessInstance(processId, {})
		// tslint:disable-next-line: no-console
		// console.log('Creating worker...') // @DEBUG
		zbc.createWorker({
			taskType: taskTypes['console-log-complete'],
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wf?.processInstanceKey)
				const res1 = await job.complete(job.variables)
				done(null)
				return res1
			},
			loglevel: 'NONE',
		})
	}))

test('Can update process variables with complete.success()', () =>
	new Promise(async done => {
		const { bpmn, taskTypes, processId } = createUniqueTaskType({
			bpmnFilePath: './src/__tests__/testdata/conditional-pathway.bpmn',
			messages: [],
			taskTypes: ['wait', 'pathB'],
		})
		const res = await zbc.deployProcess({
			definition: bpmn,
			name: `conditional-pathway-${processId}.bpmn`,
		})

		expect(res.processes.length).toBe(1)
		expect(res.processes[0].bpmnProcessId).toBe(processId)
		// tslint:disable-next-line: no-console
		// console.log('Creating process instance...') // @DEBUG
		wf = await zbc.createProcessInstance(processId, {
			conditionVariable: true,
		})
		const wfi = wf?.processInstanceKey
		expect(wfi).toBeTruthy()
		// tslint:disable-next-line: no-console
		// console.log('Creating worker...') // @DEBUG
		zbc.createWorker({
			taskType: taskTypes.wait,
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wfi)
				return job.complete({
					conditionVariable: false,
				})
			},
			loglevel: 'NONE',
		})
		// tslint:disable-next-line: no-console
		// console.log('Creating worker...') // @DEBUG
		zbc.createWorker({
			taskType: taskTypes.pathB,
			taskHandler: async job => {
				expect(job.processInstanceKey).toBe(wfi)
				expect(job.variables.conditionVariable).toBe(false)
				const res1 = await job.complete(job.variables)
				wf = undefined
				done(null)
				return res1
			},
			loglevel: 'NONE',
		})
	}))
