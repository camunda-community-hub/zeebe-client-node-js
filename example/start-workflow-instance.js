// const ZB = require('zeebe-node');
const ZB = require('../dist')

const jobs = (async () => {
	const zbc = new ZB.ZBClient()
	for (let i = 0; i < 10; i++) {
		const result = await zbc.createWorkflowInstance('test-process', {
			testData: 'something',
		})
		console.log(result)
	}
})()
