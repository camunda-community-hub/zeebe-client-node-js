const { ZBClient } = require('../dist');

  const zbc = new ZBClient({
	// loglevel: 'DEBUG',
	// camundaCloud: {
	//   clientId: process.env.CLIENT_ID,
	//   clientSecret: process.env.CLIENT_SECRET,
	//   clusterId: process.env.CLUSTER_ID,
	//   clusterRegion: process.env.CLUSTER_REGION,
	// },
  });

  zbc.deployProcess('./connector_test.bpmn').then(res => {
	console.log(res);
   	zbc.createProcessInstance('connectortest1', {}).then(console.log);
  });

  let lastJobReceived = new Date();

  const zbWorker = zbc.createWorker({
	taskType: 'camunda-cloud-connector',
	taskHandler: (job) => {
	  const now = new Date();
	  zbWorker.log(
		`received new zb job! Seconds passed since last receive: ${
		  (now.valueOf() - lastJobReceived.valueOf()) / 1000
		}`
	  );
	  lastJobReceived = new Date();
	  return job.complete();
	},
  });

  zbWorker.on('ready', () => {
	zbWorker.log('Zeebe worker is ready!');
  });
