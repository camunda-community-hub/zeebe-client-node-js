# Zeebe Node.js Client

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CircleCI](https://circleci.com/gh/creditsenseau/zeebe-client-node-js/tree/master.svg?style=svg)](https://circleci.com/gh/creditsenseau/zeebe-client-node-js/tree/master)

This is a Node.js gRPC client for [Zeebe](https://zeebe.io). It is written in TypeScript and transpiled to JavaScript in the `dist` directory.

Comprehensive API documentation is available [online](https://creditsenseau.github.io/zeebe-client-node-js/) and in the `docs` subdirectory.

Docker-compose configurations for Zeebe are available at [https://github.com/zeebe-io/zeebe-docker-compose](https://github.com/zeebe-io/zeebe-docker-compose).

## Versioning

NPM Package version 1.x.x supports Zeebe 0.15/0.16.

NPM Package version 2.x.x supports Zeebe 0.18.

## Type difference from other Zeebe clients

Protobuf fields of type `int64` are serialised as type string in the Node library. These fields are serialised as numbers (long) in the Go and Java client. See [grpc/#7229](https://github.com/grpc/grpc/issues/7229) for why the Node library serialises them as string. The Workflow instance key, and other fields that are of type long in other client libraries, are type string in this library. Fields of type `int32` are serialised as type number in the Node library.

## Example Use

### Add the Library to your Project

```bash
npm i zeebe-node
```

### Get Broker Topology

```javascript
const ZB = require('zeebe-node')

;(async () => {
	const zbc = new ZB.ZBClient('localhost:26500')
	const topology = await zbc.topology()
	console.log(JSON.stringify(topology, null, 2))

	let workflows = await zbc.listWorkflows()
	console.log(workflows)
})()
```

### Deploy a workflow

```javascript
const ZB = require('zeebe-node')

;(async () => {
	const zbc = new ZB.ZBClient('localhost:26500')

	const res = await zbc.deployWorkflow('./domain-mutation.bpmn')

	console.log(res)
})()
```

### Client-side gRPC retry in ZBClient

If a gRPC command method fails in the ZBClient - such as `ZBClient.deployWorkflow` or `ZBClient.topology()`, the underlying gRPC library will throw an exception.

If no workers have been started, this can be fatal to the process if it is not handled by the application logic. This is especially an issue when a worker container starts before the Zeebe gRPC gateway is available to service requests, and can be inconsistent as this is a race condition.

To mitigate against this, the Node client implements some client-side gRPC operation retry logic by default. This can be configured, including disabled, via configuration in the client constructor.

-   Operations retry, but only for [gRPC error code 14](https://github.com/grpc/grpc/blob/master/doc/statuscodes.md) - indicating a transient network failure. This can be caused by passing in an unresolvable gateway address (`14: DNS Resolution failed`), or by the gateway not being ready yet (`14: UNAVAILABLE: failed to connect to all addresses`).
-   Operations that fail for other reasons, such as deploying an invalid bpmn file or cancelling a workflow that does not exist, do not retry.
-   Retry is enabled by default, and can be disabled by passing { retry: false } to the client constructor.
-   `maxRetries` and `maxRetryTimeout` are also configurable through the constructor options. By default, if not supplied, the values are:

```TypeScript
const zbc = new ZB.ZBClient(gatewayAddress, {
    retry: true,
    maxRetries: 50,
    maxRetryTimeout: 5000
})
```

Retry is provided by [promise-retry](https://www.npmjs.com/package/promise-retry), and the back-off strategy is simple ^2.

### TLS

In case you need to connect to a secured endpoint, you can enable TLS.

```typescript
const zbc = new ZB.ZBClient(gatewayAddress, {
	tls: true,
})
```

### Create a Task Worker

```javascript
const ZB = require('zeebe-node')

;(async () => {
	const zbc = new ZB.ZBClient('localhost:26500')

	const zbWorker = zbc.createWorker('test-worker', 'demo-service', handler)
})()

function handler(job, complete) {
	console.log('Task variables', job.variables)
	let updatedVariables = Object.assign({}, job.variables, {
		updatedProperty: 'newValue',
	})

	// Task worker business logic goes here

	complete(updatedVariables)
}
```

Here is an example job:

```javascript

{ key: '578',
  type: 'demo-service',
  jobHeaders:
   { workflowInstanceKey: '574',
     bpmnProcessId: 'test-process',
     workflowDefinitionVersion: 1,
     workflowKey: '3',
     elementId: 'ServiceTask_0xdwuw7',
     elementInstanceKey: '577' },
  customHeaders: '{}',
  worker: 'test-worker',
  retries: 3,
  deadline: '1546915422636',
  variables: { testData: 'something' } }

```

The worker can be configured with options. Shown below are the defaults that apply if you don't supply them:

```javascript
const workerOptions = {
	maxActiveJobs: 32, // the number of simultaneous tasks this worker can handle
	timeout: 1000, // the maximum amount of time the broker should allow this worker to complete a task
}

const onConnectionError = err => console.log(err) // Called when the connection to the broker cannot be established, or fails

const zbWorker = zbc.createWorker(
	'test-worker',
	'demo-service',
	handler,
	workerOptions,
	onConnectionError
)
```

#### Unhandled Exceptions in Task Handlers

When a task handler throws an unhandled exception, the library will fail the job. Zeebe will then retry the job according to the retry settings of the task. Sometimes you want to halt the entire workflow so you can investigate. To have the library cancel the workflow on an unhandled exception, pass in `{failWorkflowOnException: true}` to the `createWorker` call:

```typescript
zbc.createWorker('test-worker', 'console-log', maybeFaultyHandler, {
	failWorkflowOnException: true,
})
```

### Completing tasks with success or failure

To complete a task, the task worker handler function receives a `complete` method. This method has a `success` and a `failure` method (as well as being able to be called directly). Calling the method directly - `complete()` is the same as calling `complete.success()`.

Call `complete.success()` (or just `complete()`) passing in a optional plain old JavaScript object (POJO) - a key:value map. These are variable:value pairs that will be used to update the workflow state in the broker.

Call `complete.failure()` to fail the task. You must pass in a string message describing the failure. The client library decrements the retry count, and the broker handles the retry logic. If the failure is a hard failure and should cause an incident to be raised in Operate, then pass in `0` for the optional second parameter, `retries`:

```javascript
complete.failure('This is a critical failure and will raise an incident', 0)
```

### Start a Workflow Instance

```javascript
const ZB = require('zeebe-node')

;(async () => {
	const zbc = new ZB.ZBClient('localhost:26500')
	const result = await zbc.createWorkflowInstance('test-process', {
		testData: 'something',
	})
	console.log(result)
})()
```

Example output:

```javascript

{ workflowKey: '3',
  bpmnProcessId: 'test-process',
  version: 1,
  workflowInstanceKey: '569' }

```

### Publish a Message

```javascript
const zbc = new ZB.ZBClient('localhost:26500')
zbc.publishMessage({
	correlationKey: 'value-to-correlate-with-workflow-variable',
	messageId: uuid.v4(),
	name: 'message-name',
	variables: { valueToAddToWorkflowVariables: 'here', status: 'PROCESSED' },
	timeToLive: 10000,
})
```

You can also publish a message targeting a [Message Start Event](https://github.com/zeebe-io/zeebe/issues/1858).
In this case, the correlation key is optional, and all Message Start events that match the `name` property will receive the message.

You can use the `publishStartMessage()` method to publish a message with no correlation key (it will be set to a random uuid in the background):

```javascript
const zbc = new ZB.ZBClient('localhost:26500')
zbc.publishStartMessage({
	messageId: uuid.v4(),
	name: 'message-name',
	variables: { initialWorkflowVariable: 'here' },
	timeToLive: 10000,
})
```

Both normal messages and start messages can be published idempotently by setting both the `messageId` and the `correlationKey`. They will only ever be correlated once. See: [A message can be published idempotent](https://github.com/zeebe-io/zeebe/issues/1012).

### Graceful Shutdown

To drain workers, call the `close()` method of the ZBClient. This causes all workers using that client to stop polling for jobs, and returns a Promise that resolves when all active jobs have either finished or timed out.

```javascript
console.log('Closing client...')
zbc.close().then(() => console.log('All workers closed'))
```

### Generating TypeScript constants for BPMN Processes

Message names and Task Types are untyped magic strings. The `BpmnParser` class provides a static method `generateConstantsForBpmnFiles()`.
This method takes a filepath and returns TypeScript definitions that you can use to avoid typos in your code, and to reason about the completeness of your task worker coverage.

```javascript
const ZB = require('zeebe-node')
;(async () => {
	console.log(await ZB.BpmnParser.generateConstantsForBpmnFiles(workflowFile))
})()
```

This will produce output similar to:

```typescript
// Autogenerated constants for msg-start.bpmn

export enum TaskType = {

    CONSOLE_LOG = "console-log"

};

export enum MessageName = {

    MSG_EMIT_FRAME = "MSG-EMIT_FRAME",
    MSG_START_JOB = "MSG-START_JOB"

};

```

## Logging

Control the log output for the client library by setting the ZBClient log level. Valid log levels are `NONE` (supress all logging), `ERROR` (log only exceptions), `INFO` (general logging), or `DEBUG` (verbose logging). You can set this in the client constructor:

```typescript
const zbc = new ZBClient('localhost', { loglevel: 'DEBUG' })
```

And also via the environment:

```bash
ZB_NODE_LOG_LEVEL='ERROR' node start.js
```

By default the library uses `console.info` and `console.error` for logging. You can also pass in a custom logger, such as [pino](https://github.com/pinojs/pino):

```typescript
const logger = require('pino')()
const zbc = new ZBClient('0.0.0.0:26500', { stdout: logger })
```

## Developing

The source is written in TypeScript in `src`, and compiled to ES6 in the `dist` directory.

To build:

```bash
npm run build
```

To start a watcher to build the source and API docs while you are developing:

```bash
npm run dev
```

### Tests

Tests are written in Jest, and live in the `src/__tests__` directory. To run the unit tests:

```bash
npm t
```

Integration tests are in the `src/__tests__/integration` directory.

They require a Zeebe broker to run. You can run them using the [Circle CI CLI](https://circleci.com/docs/2.0/local-cli/):

```bash
circleci local execute -c .circleci/config.yml --job test
```

Or you can start a dockerised broker:

```bash
cd docker
docker-compose up
```

And then run them manually:

```bash
npm run test:integration
```

For the failure test, you need to run Operate ([docker-compose config](https://github.com/zeebe-io/zeebe-docker-compose/blob/master/operate/docker-compose.yml)) and manually verify that an incident has been raised at [http://localhost:8080](http://localhost:8080).

## Contributors

| Name                                                         |
| ------------------------------------------------------------ |
| **[Josh Wulf](https://github.com/jwulf)**                    |
| **[Jarred Filmer](https://github.com/BrighTide)**            |
| **[Timothy Colbert](https://github.com/s3than)**             |
| **[Olivier Albertini](https://github.com/OlivierAlbertini)** |
