# Zeebe Node.js Client

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CircleCI](https://circleci.com/gh/creditsenseau/zeebe-client-node-js/tree/master.svg?style=svg)](https://circleci.com/gh/creditsenseau/zeebe-client-node-js/tree/master)

This is a Node.js gRPC client for [Zeebe](https://zeebe.io). It is written in TypeScript and transpiled to JavaScript in the `dist` directory.

Comprehensive API documentation is available [online](https://creditsenseau.github.io/zeebe-client-node-js/).

See CHANGELOG.md to see what has changed with each release.

Docker-compose configurations for Zeebe are available at [https://github.com/zeebe-io/zeebe-docker-compose](https://github.com/zeebe-io/zeebe-docker-compose).

## Versioning

To enable that the client libraries can be easily supported to the Zeebe server we map the version numbers, so that Major, Minor match the server application. Patches are independent and indicate client updates.

NPM Package version 0.22.x supports Zeebe 0.22.x

NPM Package version 0.21.x supports Zeebe 0.21.x

NPM Package version 0.20.x supports Zeebe 0.20.x

NPM Package version 0.19.x supports Zeebe 0.19.x

NPM Package version 2.x.x supports Zeebe 0.18.

NPM Package version 1.x.x supports Zeebe 0.15/0.16.

## Type difference from other Zeebe clients

Protobuf fields of type `int64` are serialised as type string in the Node library. These fields are serialised as numbers (long) in the Go and Java client. See [grpc/#7229](https://github.com/grpc/grpc/issues/7229) for why the Node library serialises them as string. The Workflow instance key, and other fields that are of type long in other client libraries, are type string in this library. Fields of type `int32` are serialised as type number in the Node library.

## Scaffolding code from a BPM file

You can scaffold your worker code from a BPMN file with the `bin/zeebe-node-cli` command. Pass in the path to the BPMN file, and it will produce a file to implement it.

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
})()
```

### Deploy a workflow

```javascript
const ZB = require('zeebe-node')
const fs = require('fs')

;(async () => {
	const zbc = new ZB.ZBClient() // localhost:26500 || ZEEBE_GATEWAY_ADDRESS

	const res = await zbc.deployWorkflow('./domain-mutation.bpmn')
	console.log(res)

	// Deploy multiple with an array of filepaths
	await zbc.deployWorkflow(['./wf1.bpmn', './wf2.bpmn'])

	const buffer = fs.readFileSync('./wf3.bpmn')

	// Deploy from an in-memory buffer
	await zbc.deployWorkflow({ definition: buffer, name: 'wf3.bpmn' })
})()
```

### Client-side gRPC retry in ZBClient

If a gRPC command method fails in the ZBClient - such as `ZBClient.deployWorkflow` or `ZBClient.topology()`, the underlying gRPC library will throw an exception.

If no workers have been started, this can be fatal to the process if it is not handled by the application logic. This is especially an issue when a worker container starts before the Zeebe gRPC gateway is available to service requests, and can be inconsistent as this is a race condition.

To mitigate against this, the Node client implements some client-side gRPC operation retry logic by default. This can be configured, including disabled, via configuration in the client constructor.

-   Operations retry, but only for [gRPC error codes 8 and 14](https://github.com/grpc/grpc/blob/master/doc/statuscodes.md) - indicating resource exhaustion (8) or transient network failure (14). Resource exhaustion occurs when the broker starts backpressure due to latency because of load. Network failure can be caused by passing in an unresolvable gateway address (`14: DNS Resolution failed`), or by the gateway not being ready yet (`14: UNAVAILABLE: failed to connect to all addresses`).
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

Additionally, the gRPC Client will continually reconnect when in a failed state, such as when the gateway goes away due to pod rescheduling on Kubernetes.

### onReady(), onConnectionError(), and connected

The client has a `connected` property that can be examined to determine if it has a gRPC connection to the gateway.

The client and the worker can take an optional `onReady()` and `onConnectionError()` handler in their options, like this:

```TypeScript
const zbc = new ZB.ZBClient({
	onReady: () => console.log(`Connected!`),
	onConnectionError: () => console.log(`Disconnected!`)
})

const zbWorker = zbc.createWorker(
	null,
	'demo-service',
	handler,
	{
		onReady: () => console.log(`Worker connected!`),
		onConnectionError: () => console.log(`Worker disconnected!`)
	})
```

These handlers are called whenever the gRPC channel is established or lost. As the channel will jitter when it is lost, there is a `connectionTolerance` property that determines how long the connection must be in a connected or failed state before the handler is called. By default this is 3000ms. You can specify another value like this:

```TypeScript
const zbc = new ZB.ZBClient({
	onReady: () => console.log(`Connected!`),
	onConnectionError: () => console.log(`Disconnected!`),
	connectionTolerance: 5000
})

const zbWorker = zbc.createWorker(
	null,
	'demo-service',
	handler,
	{
		onReady: () => console.log(`Worker connected!`),
		onConnectionError: () => console.log(`Worker disconnected!`),
		connectionTolerance: 35000
	})
```

### TLS

Enable a secure connection by setting `useTLS: true`:

```typescript
const zbc = new ZB.ZBClient(tlsProxiedGatewayAddress, {
	useTLS: true,
})
```

### OAuth

In case you need to connect to a secured endpoint with OAuth, you can pass in OAuth credentials. This will enable TLS (unless you explicitly disable it with `useTLS: false`), and handle the OAuth flow to get / renew a JWT:

```typescript
const zbc = new ZB.ZBClient("my-secure-broker.io:443", {
	oAuth: {
		url: "https://your-auth-endpoint/oauth/token",
		audience: "my-secure-broker.io",
		clientId: "myClientId",
		clientSecret:
		"randomClientSecret",
		cacheOnDisk: true
	}
}
```

The `cacheOnDisk` option will cache the token on disk in `$HOME/.camunda`, which can be useful in development if you are restarting the service frequently, or are running in a serverless environment, like AWS Lambda.

If the cache directory is not writable, the ZBClient constructor will throw an exception. This is considered fatal, as it can lead to denial of service or hefty bills if you think caching is on when it is not.

## Basic Auth

If you put a proxy in front of the broker with basic auth, you can pass in a username and password:

```typescript
const zbc = new ZB.ZBClient("my-broker-with-basic-auth.io:443", {
	basicAuth: {
		username: "user1",
		password: "secret",
	},
	useTLS: true
}
```

Basic Auth will also work without TLS.

### Camunda Cloud

You can connect to Camunda Cloud by using the `camundaCloud` configuration option, using the `clusterId`, `clientSecret`, and `clientId` from the Camunda Cloud Console, like this:

```typescript
const zbc = new ZB.ZBClient({
	camundaCloud: {
		clientId,
		clientSecret,
		clusterId,
	},
})
```

That's it! Under the hood, the client lib will construct the OAuth configuration for Camunda Cloud and set the gateway address and port for you.

## Zero-Conf constructor

The ZBClient has a 0-parameter constructor that takes the config from the environment. This is useful for injecting secrets into your app via the environment, and switching between development and production environments with no change to code.

To use the zero-conf constructor, you create the client like this:

```typescript
const zbc = new ZBClient()
```

With no relevant environment variables set, it will default to localhost on the default port with no TLS.

The following environment variable configurations are possible with the Zero-conf constructor:

Camunda Cloud:

```
ZEEBE_GATEWAY_ADDRESS
ZEEBE_CLIENT_SECRET
ZEEBE_CLIENT_ID
```

Self-hosted or local broker (no TLS or OAuth):

```
ZEEBE_GATEWAY_ADDRESS
```

Self-hosted or local broker with OAuth + TLS:

```
ZEEBE_CLIENT_ID
ZEEBE_CLIENT_SECRET
ZEEBE_TOKEN_AUDIENCE
ZEEBE_AUTHORIZATION_SERVER_URL
ZEEBE_GATEWAY_ADDRESS
```

Basic Auth:

```
ZEEBE_BASIC_AUTH_PASSWORD
ZEEBE_BASIC_AUTH_USERNAME
```

### Create a Task Worker

```javascript
const ZB = require('zeebe-node')

const zbc = new ZB.ZBClient('localhost:26500')

const zbWorker = zbc.createWorker(null, 'demo-service', handler)

function handler(job, complete) {
	console.log('Task variables', job.variables)

	// Task worker business logic goes here
	const updateToBrokerVariables = {
		updatedProperty: 'newValue',
	}

	complete(updateToBrokerVariables)
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

To complete a task, the task worker handler function receives a `complete` parameter. The complete object has a `success` and a `failure` method.

Call `complete.success()` passing in a optional plain old JavaScript object (POJO) - a key:value map. These are variable:value pairs that will be used to update the workflow state in the broker. They will be merged with existing values. You can set an existing key to `null` or `undefined`, but there is no way to delete a key.

Call `complete.failure()` to fail the task. You must pass in a string message describing the failure. The client library decrements the retry count, and the broker handles the retry logic. If the failure is a hard failure and should cause an incident to be raised in Operate, then pass in `0` for the optional second parameter, `retries`:

```javascript
complete.failure('This is a critical failure and will raise an incident', 0)
```

### Long polling

With Zeebe 0.21 onward, long polling is supported for clients, and is used by default. Rather than polling continuously for work and getting nothing back, a client can poll once and leave the request open until work appears. This reduces network traffic and CPU utilization in the server. Every JobActivation Request is appended to the event log, so continuous polling can significantly impact broker performance, especially when an exporter is loaded (see [here](https://github.com/creditsenseau/zeebe-client-node-js/issues/64#issuecomment-520233275)).

The default long polling period is 60000ms (60s).

To use a different long polling period, pass in a long poll timeout in milliseconds to the client. All workers created with that client will use it. Alternatively, set a period per-worker.

Long polling for workers is configured in the ZBClient like this:

```typescript
const zbc = new ZBClient('serverAddress', {
	longPoll: 600000, // Ten minutes in millis - inherited by workers
})

const longPollingWorker = zbc.createWorker(null, 'task-type', handler, {
	longPoll: 120000, // override client, poll 2m
})
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

### Start a Workflow Instance of a specific version of a Workflow definition

From version 0.22 of the client onward:

```javascript
const ZB = require('zeebe-node')

;(async () => {
	const zbc = new ZB.ZBClient('localhost:26500')
	const result = await zbc.createWorkflowInstance({
		bpmnProcessId: 'test-process',
		variables: {
			testData: 'something',
		},
		version: 5,
	})
	console.log(result)
})()
```

### Start a workflow instance and await the workflow outcome

From version 0.22 of the broker and client:

```typescript
const result = await zbc.createWorkflowInstanceWithResult(processId, {
	sourceValue: 5,
})
```

Overriding the gateway's default timeout for a workflow that needs more time to complete:

```typescript
const result = await zbc.createWorkflowInstanceWithResult({
	bpmnProcessId: processId,
	variables: {
		sourceValue: 5,
		otherValue: 'rome',
	},
	requestTimeout: 25000,
})
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
ZEEBE_NODE_LOG_LEVEL='ERROR' node start.js
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

### Writing Tests

Zeebe is inherently stateful, so integration tests need to be carefully isolated so that workers from one test do not service tasks in another test. Jest runs tests in a random order, so intermittent failures are the outcome of tests that mutate shared state.

For each feature:

-   Use a unique bpmn process, named the same as the test file. Don't reuse processes between tests, because they are tightly coupled.
-   Name the task types with a namespace that matches the test name. This avoids workers from one test servicing tasks from another test, which causes unpredictable behaviour.
-   Cancel any workflows that do not run to completion in an `AfterAll` or `AfterEach` block. This avoids subsequent test runs interacting with workflows from a previous test run.
-   Ensure that there no Active workflows in the engine after running the integration tests have run. This manual check is to verify that there is no left-over state. (Note one exception: the Raise Incident test leaves the workflow open for manual verification in Operate).

## Contributors

| Name                                                         |
| ------------------------------------------------------------ |
| **[Josh Wulf](https://github.com/jwulf)**                    |
| **[Colin Raddatz](https://github.com/ColRad)**               |
| **[Jarred Filmer](https://github.com/BrighTide)**            |
| **[Timothy Colbert](https://github.com/s3than)**             |
| **[Olivier Albertini](https://github.com/OlivierAlbertini)** |
| **[Patrick Dehn](https://github.com/pedesen)**               |
