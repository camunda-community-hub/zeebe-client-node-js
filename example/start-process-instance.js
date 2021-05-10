// const ZB = require('zeebe-node');
const ZB = require('../dist')

const jobs = (async () => {
	const zbc = new ZB.ZBClient()
	for (let i = 0; i < 10; i++) {
		const result = await zbc.createProcessInstance('test-process', {
			testData: `process #${i}`,
		})
		console.log(result)
	}
})()
