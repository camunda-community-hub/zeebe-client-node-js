// const ZB = require('zeebe-node');
const ZB = require('../dist')

;(async () => {
	const zbc = new ZB.ZBClient()
	const topology = await zbc.topology()
	console.log(JSON.stringify(topology, null, 2))

	await zbc.deployProcess('./test.bpmn')

	zbc.createWorker({
		taskType: 'demo-service',
		taskHandler: job => {
			console.log(job.variables)
			job.complete()
		},
	}) // handler)

	setTimeout(() => {
		console.log('Closing client...')
		zbc.close().then(() => console.log('All workers closed'))
	}, 10 * 60 * 1000)
})()
