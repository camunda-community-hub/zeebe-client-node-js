import { ZBClient } from "../../index";

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

let zbc: ZBClient
let pid: string
beforeEach(() => (zbc = new ZBClient()))
afterEach(async () => {
	zbc.cancelProcessInstance(pid).catch(_ => _)
	await zbc.close()
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

