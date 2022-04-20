// const ZB = require('zeebe-node');
const ZB = require('../dist')

	; (async () => {
		const zbc = new ZB.ZBClient({
			onConnectionError: () => console.log('Connection Error'),
			onReady: () => console.log('Ready to work'),
		})
		const topology = await zbc.topology()
		console.log(JSON.stringify(topology, null, 2))

		const res = await zbc.deployProcess('./test.bpmn')
		setTimeout(() => console.log(res), 5000)
	})()
