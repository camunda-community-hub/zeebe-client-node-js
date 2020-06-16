// const ZB = require('zeebe-node');
const ZB = require('../dist')

;(async () => {
	const zbc = new ZB.ZBClient({
		onConnectionError: err => console.log('err', err),
		onReady: () => console.log('YOO'),
	})
	const topology = await zbc.topology()
	console.log(JSON.stringify(topology, null, 2))

	const res = await zbc.deployWorkflow('./test.bpmn')
	setTimeout(() => console.log(res), 5000)
})()
