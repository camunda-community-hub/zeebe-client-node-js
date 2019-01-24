// const ZB = require('zeebe-node');
const ZB = require('../dist');

(async() => {
    const zbc = new ZB.ZBClient("localhost:26500");
    const result = await zbc.createWorkflowInstance({bpmnProcessId: "test-process", payload: {testData: "something"}});
    console.log(result);
})();