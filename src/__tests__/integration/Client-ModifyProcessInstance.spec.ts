import { cancelProcesses } from "../../lib/cancelProcesses";
import { DeployProcessResponse, ZBClient } from "../../index";

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

const zbc = new ZBClient()
let pid: string
let test1: DeployProcessResponse

beforeAll(async () => {
	test1 = await zbc.deployProcess('./src/__tests__/testdata/Client-SkipFirstTask.bpmn')
})
afterEach(async () => {
	zbc.cancelProcessInstance(pid).catch(_ => _)
	await zbc.close()
	await cancelProcesses(test1.processes[0].bpmnProcessId)
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
	zbc.createProcessInstance('SkipFirstTask', {}).then(res => {
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

