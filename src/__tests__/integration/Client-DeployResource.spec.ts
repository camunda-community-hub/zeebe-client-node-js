import { ZBClient } from '../../index'
import { createUniqueTaskType } from '../../lib/createUniqueTaskType'
import fs from 'fs'
process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
jest.setTimeout(20000)
test('deploys a process', async () => {
	const zbc = new ZBClient()
	const { bpmn, processId } = createUniqueTaskType({
		bpmnFilePath: `./src/__tests__/testdata/Client-DeployWorkflow.bpmn`,
		messages: [],
		taskTypes: [],
	})
	const result = await zbc.deployResource({
		process: bpmn,
		name: `Client-DeployProcess-${processId}.bpmn`,
	})
	await zbc.close()
	expect(result.deployments[0].process.bpmnProcessId).toBe(processId)
})
test('deploys a process from a file', async () => {
	const zbc = new ZBClient()
	const result = await zbc.deployResource({
		processFilename: `./src/__tests__/testdata/Client-DeployWorkflow.bpmn`,
	})
	await zbc.close()
	expect(result.deployments[0].process.version).toBeGreaterThanOrEqual(1)
})
test('deploys a DMN table from a filename', async () => {
	const zbc = new ZBClient()
	const result = await zbc.deployResource({
		decisionFilename: './src/__tests__/testdata/quarantine-duration.dmn',
	})
	await zbc.close()
	expect(result.deployments[0].decision.decisionKey).not.toBeNull()
})
test('deploys a DMN table', async () => {
	const zbc = new ZBClient()
	const decision = fs.readFileSync(
		'./src/__tests__/testdata/quarantine-duration.dmn'
	)
	const result = await zbc.deployResource({
		decision,
		name: 'quarantine-duration.dmn',
	})
	await zbc.close()
	expect(result.deployments[0].decision.decisionKey).not.toBeNull()
})
