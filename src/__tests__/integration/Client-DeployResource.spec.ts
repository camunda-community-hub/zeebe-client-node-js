import { cancelProcesses } from '../../lib/cancelProcesses'
import { ZBClient, BpmnParser } from '../../index'
import fs from 'fs'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(20000)

const zbc = new ZBClient()
const bpmnString = fs.readFileSync(`./src/__tests__/testdata/Client-DeployWorkflow.bpmn`, 'utf8')
const expectedPid = BpmnParser.getProcessId(bpmnString)

beforeAll(async () =>
	await cancelProcesses(expectedPid)
)

afterAll(async () =>
	await zbc.close()
)

test('deploys a process', async () => {
	const result = await zbc.deployResource({
		process: Buffer.from(bpmnString),
		name: `Client-DeployWorkflow.bpmn`,
	})
	expect(result.deployments[0].process.bpmnProcessId).toBe(expectedPid)
})
test('deploys a process from a file', async () => {
	const result = await zbc.deployResource({
		processFilename: `./src/__tests__/testdata/Client-DeployWorkflow.bpmn`,
	})
	expect(result.deployments[0].process.version).toBeGreaterThanOrEqual(1)
})
test('deploys a DMN table from a filename', async () => {
	const result = await zbc.deployResource({
		decisionFilename: './src/__tests__/testdata/quarantine-duration.dmn',
	})
	expect(result.deployments[0].decision.decisionKey).not.toBeNull()
})
test('deploys a DMN table', async () => {
	const decision = fs.readFileSync(
		'./src/__tests__/testdata/quarantine-duration.dmn'
	)
	const result = await zbc.deployResource({
		decision,
		name: 'quarantine-duration.dmn',
	})
	expect(result.deployments[0].decision.decisionKey).not.toBeNull()
})
test('deploys a Form', async () => {
	const form = fs.readFileSync(
		'./src/__tests__/testdata/form_1.form'
	)
	const result = await zbc.deployResource({
		form,
		name: 'form_1.form',
	})
	expect(result.deployments[0].form).not.toBeNull()
})
