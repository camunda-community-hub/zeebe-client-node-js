// const ZB = require('zeebe-node');
const ZB = require('../dist');

(async() => {
    const zbc = new ZB.ZBClient("localhost:26500");

    const topology = await zbc.topology();
    console.log(JSON.stringify(topology, null, 2));

    let workflows = await zbc.listWorkflows();
    console.log(workflows);

    await zbc.deployWorkflow('./test.bpmn');

    workflows = await zbc.listWorkflows();
    console.log(workflows);
})();