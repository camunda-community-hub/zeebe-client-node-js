// const ZB = require('zeebe-node');
const ZB = require('../dist');

(async () => {
    const zbc = new ZB.ZBClient("localhost:26500");
    const topology = await zbc.topology();
    console.log(JSON.stringify(topology, null, 2));
    let workflows = await zbc.listWorkflows();
    console.log(workflows);

    await zbc.deployWorkflow('./test.bpmn');
    workflows = await zbc.listWorkflows();
    console.log(workflows);
    const zbWorker = zbc.createWorker("test-worker", "demo-service", handler);
    setTimeout(() => {
        console.log('Closing client...');
        zbc.close().then(() => console.log('All workers closed'));
    }, 10000);
})();

function handler(payload, complete) {
    console.log("ZB payload", payload);
    complete(payload);
}