import { cancelProcesses } from '../../lib/cancelProcesses'
import { DeployProcessResponse, ZBClient } from '../..'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(25000)

const zbc = new ZBClient()
let test1: DeployProcessResponse
let test2: DeployProcessResponse
let test3: DeployProcessResponse

beforeAll(async () => {
	test1 = await zbc.deployProcess('./src/__tests__/testdata/await-outcome.bpmn')
	test2 = await zbc.deployProcess('./src/__tests__/testdata/await-outcome-long.bpmn')
	test3 = await zbc.deployProcess('./src/__tests__/testdata/await-outcome.bpmn')
	await cancelProcesses(test1.processes[0].bpmnProcessId)
	await cancelProcesses(test2.processes[0].bpmnProcessId)
	await cancelProcesses(test3.processes[0].bpmnProcessId)
})

afterAll(async () => {
	await zbc.close() // Makes sure we don't forget to close connection
	await cancelProcesses(test1.processes[0].bpmnProcessId)
	await cancelProcesses(test2.processes[0].bpmnProcessId)
	await cancelProcesses(test3.processes[0].bpmnProcessId)
})

test('Awaits a process outcome', async () => {
	const processId = test1.processes[0].bpmnProcessId
	const result = await zbc.createProcessInstanceWithResult({
		bpmnProcessId: processId,
		variables: {
		sourceValue: 5
		}
	})
	expect(result.variables.sourceValue).toBe(5)
})

test('can override the gateway timeout', async () => {
	const processId = test2.processes[0].bpmnProcessId
	const result = await zbc.createProcessInstanceWithResult({
		bpmnProcessId: processId,
		requestTimeout: 25000,
		variables: {
			otherValue: 'rome',
			sourceValue: 5,
		}
	})
	expect(result.variables.sourceValue).toBe(5)
})

test('fetches a subset of variables', async () => {
	const processId = test3.processes[0].bpmnProcessId
	const result = await zbc.createProcessInstanceWithResult({
		bpmnProcessId: processId,
		fetchVariables: ['otherValue'],
		variables: {
			otherValue: 'rome',
			sourceValue: 5,
		},
	})
	expect(result.variables.sourceValue).toBe(undefined)
	expect(result.variables.otherValue).toBe('rome')
})
