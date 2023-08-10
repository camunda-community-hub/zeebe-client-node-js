import { cancelProcesses } from "../../lib/cancelProcesses";
import { ZBClient } from "../../index";

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

const zbc = new ZBClient()
let pid: string
let processModelId: string

beforeAll(async () => {
	const res = await zbc.deployProcess('./src/__tests__/testdata/Client-SkipFirstTask.bpmn')
	processModelId = res.processes[0].bpmnProcessId
})
afterAll(async () => {
	zbc.cancelProcessInstance(pid).catch(_ => _)
	await zbc.close()
	await cancelProcesses(processModelId)
})

test('Modify Process Instance', done =>{
	zbc.deployProcess('./src/__tests__/testdata/Client-SkipFirstTask.bpmn')
	zbc.createWorker({
		taskType: 'second_service_task',
		taskHandler: job => {
			expect(job.variables.second).toBe(1)
			return job.complete().then(() => done())
		}
	})
	zbc.createProcessInstance({
		bpmnProcessId: 'SkipFirstTask',
		variables: {}
	}).then(res => {
		pid = res.processInstanceKey
		zbc.modifyProcessInstance({
			processInstanceKey: res.processInstanceKey,
			activateInstructions: [{
				elementId: 'second_service_task',
				ancestorElementInstanceKey: "-1",
				variableInstructions: [{
					scopeId: '',
					variables: { second: 1}
				}]
			}]
		})
	})
})

