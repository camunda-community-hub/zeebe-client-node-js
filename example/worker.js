// const ZB = require('zeebe-node');
const ZB = require('../dist')

;(async () => {
	const zbc = new ZB.ZBClient()
	const topology = await zbc.topology()
	console.log(JSON.stringify(topology, null, 2))

	await zbc.deployWorkflow('./test.bpmn')
	workflows = await zbc.listWorkflows()
	console.log(workflows)

	const zbWorker = zbc.createWorker('demo-service', handler)
	setTimeout(() => {
		console.log('Closing client...')
		zbc.close().then(() => console.log('All workers closed'))
	}, 1000000)
})()

function handler(job, complete) {
	console.log('Job payload', job)
	complete(job.variables)
}
