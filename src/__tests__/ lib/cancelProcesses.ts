import { OperateApiClient } from 'operate-api-client'

const operate = new OperateApiClient()

export async function cancelProcesses(processDefinitionKey: string) {
	const processes = await operate.searchProcessInstances({
		filter: {
			processDefinitionKey: +processDefinitionKey
		}
	})
	await Promise.all(processes.items.map(item =>
		operate.deleteProcessInstance(+item.bpmnProcessId)
	))
}


function createClient() {
	try {
		return new OperateApiClient()
	} catch (e) {
		console.log(e.message)
		console.log(`Running without access to Operate`)
		return null
	}
}
