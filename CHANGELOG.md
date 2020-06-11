# Version 0.23.3

## Breaking Changes

-   This version goes back to the C-based gRPC implementation. We found several issues with the pure JS gRPC implementation and the nghttp2 implementation in Node. The issues differ between Node versions, and are challenging to isolate, as they occur in the Node engine itself. By default, in this version, the Zeebe Node client uses the C-based gRPC client. If you want to participate in testing the pure JS client (bug reports welcome!), you can activate the pure JS gRPC client by setting `ZEEBE_NODE_PUREJS=true`.
-   Prior to this release, the default value for `maxRetries` was 50 (about 2 minutes). This caused workers started more than 2 minutes before the broker to abandon connection attempts and fail to connect. With this release, retries are infinite by default.

# Version 0.23.2

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   Node 12 has issues with the new pure JS implementation. We don't have a compatibility matrix yet, but Node 14 works.
-   The `onConnectionError` event of the ZBClient and ZBWorker/ZBBatchWorker is not debounced, and may be called multiple times in succession when the channel jitters, or the broker is not available. See [#161](https://github.com/creditsenseau/zeebe-client-node-js/issues/161).

## Fixes

_Things that were broken and are now fixed._

-   The client's gRPC channel would not reconnect if a Zeebe broker in Docker is restarted. The `@grpc/grpc-js` package is updated to 1.0.4 to bring in the fix for [@grpc/grpc-js #1411](https://github.com/grpc/grpc-node/issues/1411). This enables the client to reliably reconnect to brokers that are restarted in Docker or rescheduled in Kubernetes.

# Version 0.23.2

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   The `onConnectionError` event of the ZBClient and ZBWorker/ZBBatchWorker is not debounced, and may be called multiple times in succession when the channel jitters, or the broker is not available. See [#161](https://github.com/creditsenseau/zeebe-client-node-js/issues/161).

## Fixes

_Things that were broken and are now fixed._

-   The `dist` directory is now in the published package. Thanks to [@lwille](https://github.com/lwille) for the PR that fixed the build. See [#163](https://github.com/creditsenseau/zeebe-client-node-js/issues/163).

# Version 0.23.0

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   There is no `dist` directory in this release. See [#163](https://github.com/creditsenseau/zeebe-client-node-js/issues/163), and _do not use this release_.
-   The `onConnectionError` event of the ZBClient and ZBWorker/ZBBatchWorker is not debounced, and may be called multiple times in succession when the channel jitters, or the broker is not available. See [#161](https://github.com/creditsenseau/zeebe-client-node-js/issues/161).

## Breaking Changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The `job.variables` and `job.customHeaders` in the worker job handler are now typed as read-only structures. This will only be a breaking change if your code relies on mutating these data structures. See the section "Working with Workflow Variables and Custom Headers" in the README for an explanation on doing deep key updates on the job variables.
-   The ZBClient no longer eagerly connects to the broker by default. Previously, it did this by issuing a topology command in the constructor. This allows you an onReady event to be emitted. You can re-enable the eager connection behavior, by either passing `eagerConnection: true` to the client constructor options, or setting the environment variable `ZEEBE_NODE_EAGER_CONNECTION` to `true`. See [#151](https://github.com/creditsenseau/zeebe-client-node-js/issues/151).
-   The library nows logs with the simplified `ZBSimpleLogger` by default, for friendly human-readable logs. This will only be a breaking change if you currently rely on the structured log output. To get the previous structured log behaviour, pass in `stdout: ZBJsonLogger` to the `ZBClient` constructor options, or set the environment variable `ZEEBE_NODE_LOG_TYPE` to `JSON`. Refer to the "Logging" section in the README.

## New Features

_New shiny stuff._

-   The underlying gRPC implementation has been switched to the pure JS @grpc/grpc-js. This means no more dependency on node-gyp or binary rebuilds for Docker containers / Electron; and a slim-down in the installed package size from 50MB to 27MB. All tests pass, including some new ones (for example: the worker keeps working when the broker goes away and comes back). The JS gRPC implementation _may_ have effects on the behaviour of the client that are not covered in the unit and integration tests. Please open a GitHub issue if you encounter something.
-   Timeouts can now be expressed with units using the [typed-duration](https://www.npmjs.com/package/typed-duration) package, which is included in and re-exported by the library. See the README section "A note on representing timeout durations".
-   There is a new `ZBBatchWorker`. This allows you to batch jobs that are unrelated in a BPMN model, but are related with respect to some (for example: rate-limited) external system. See the README for details. Thanks to Jimmy Beaudoin ([@jbeaudoin11](https://github.com/jbeaudoin11)) for the suggestion, and helping with the design. Ref: [#134](https://github.com/creditsenseau/zeebe-client-node-js/issues/134).
-   `ZBClient.createWorker` has two new, additional, method signature. The first is a single object parameter signature. This is the preferred signature if you are passing in configuration options. The second signature is a version of the original that elides the `id` for the worker. With this, you can create a worker with just a task type and a job handler. A UUID is assigned as the worker id. This is the equivalent of passing in `null` as the first parameter to the original signature. The previous method signature still works, allowing you to specify an id if you want. See [this article for details](https://www.joshwulf.com/blog/2020/02/refining-method-signature/).
-   There is now a `ZBLogMessage` interface to help you implement a custom logger [#127](https://github.com/creditsenseau/zeebe-client-node-js/issues/127). For an example of a custom logger, see the [Zeebe GitHub Action implementation](https://github.com/jwulf/zeebe-action/blob/master/src/log/logger.ts).
-   There is new custom logger implementation `ZBSimpleLogger` that produces flat string output. If you are not interested in structured logs for analysis, this log is easier for humans to read.
-   `ZBClient` now contains an `activateJobs` method. This effectively exposes the entire Zeebe GRPC API, and allows you to write applications in the completely unmanaged style of the Java and Go libraries, if you have some radically different idea about application patterns.
-   The Grpc layer has been refactored to implement the idea of "connection characteristics". When connecting to Camunda Cloud, which uses TLS and OAuth, the library would emit errors every time. The refactor allows these connection errors to be correctly interpreted as expected behaviour of the "connection characteristics". You can also set an explicit initial connection tolerance in milliseconds for any broker connection with the environment variable `ZEEBE_INITIAL_CONNECTION_TOLERANCE`. See [this article](https://www.joshwulf.com/blog/2020/03/camunda-cloud-connection-2/), issue [#133](https://github.com/creditsenseau/zeebe-client-node-js/issues/133), and the README section "Initial Connection Tolerance" for more details.
-   The connection tolerance for transient drop-outs before reporting a connection error is now configurable via the environment variable `ZEEBE_CONNECTION_TOLERANCE`, as well as the previous constructor argument `connectionTolerance`.
-   The Node client now emits a client-agent header to facilitate debugging on Camunda Cloud. See [#155](https://github.com/creditsenseau/zeebe-client-node-js/issues/155).
-   The integration tests have been refactored to allow them to run against Camunda Cloud. This required dealing with a Zeebe broker in an unknown state, so all tests now template unique process ids, unique task types, and unique message names to avoid previous test run state in the cluster interfering with subsequent test runs.
-   I've started documenting the internal operation of the client in BPMN diagrams. These can be found in the `design` directory.
-   The README now contains a section "Writing Strongly-typed Job Workers", on writing typed workers in TypeScript.
-   The README also has a shiny TOC. It has grown in size such that one is needed.

## Fixes

_Things that were broken and are now fixed._

-   An unmaintained package in the dependency tree of kafka-node (and arguably a bug in NPM's de-duping algorithm) caused zeebe-node to break by installing the wrong version of the `long` dependency, unless the two packages were installed in a specific order. We've explicitly added `long` to the dependencies of zeebe-node to address this, and [reported it to kafka-node](https://github.com/SOHU-Co/kafka-node/issues/1332). Thanks to [@need4eat](https://github.com/need4eat) for discovering this and helping to track down the cause. See [#124](https://github.com/creditsenseau/zeebe-client-node-js/issues/124).
-   Prior to 0.23.0 of the zeebe-node client, a worker would not reconnect if the broker was restarted, throwing gRPC channel errors until they were restarted. A stalled retry timer has been added to the worker. The worker will now automatically reconnect when the broker is available, if it goes away and comes back. See [#99](https://github.com/creditsenseau/zeebe-client-node-js/issues/99), [#145](https://github.com/creditsenseau/zeebe-client-node-js/issues/145), and [#152](https://github.com/creditsenseau/zeebe-client-node-js/issues/152).

# Version 0.22.1

## Breaking Changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The default job activation timeout for the ZBWorker has been changed from 1s to 60s.
-   The signature for specifying a workflow definition version in `createWorkflowInstance` has changed. See the README for the new signature.
-   If the oAuth `cacheOnDisk` is true and the directory `$HOME/.camunda` is not writable, then the ZBClient constructor will now throw to prevent unbounded token requests. Thanks to GitHub user MainAero for reporting this. See [#110](https://github.com/creditsenseau/zeebe-client-node-js/issues/110).
-   Change default long poll for workers to 30s. See [#101](https://github.com/creditsenseau/zeebe-client-node-js/issues/101).
-   The ZBClient no longer bubbles up gRPC status from its workers. See [#109](https://github.com/creditsenseau/zeebe-client-node-js/issues/109) and [this comment](https://github.com/creditsenseau/zeebe-client-node-js/issues/99#issuecomment-554926818).
-   Remove `pollMode` (it's now always long-poll), and add `pollInterval` in ZBLogger messages.

## New Features

_New shiny stuff._

-   You can now throw a BPMN Error in your process from a worker using the `complete.error(errorCode: string, errorMessage?: string)` method, or from the client using the `ZBClient.throwError(throwErrorRequest: ThrowErrorRequest)` method.
-   If you install the package globally with `npm i -g zeebe-node`, you get the command `zeebe-node <filename>` that parses a BPMN file and emits type definitions.
-   The oAuth token cache directory is now configurable via the ZBClient constructor parameter `oAuth.cacheDir` or the environment variable `ZEEBE_TOKEN_CACHE_DIR`.
-   Add support for Basic Auth. See [this commit](https://github.com/jwulf/zeebe-client-node-js/commit/bd261a7417d68ff9c6739b3057a042aaade7eb4a) and the README for details.
-   Awaitable workflow outcome. With a 0.22 broker, the client can initiate a workflow and receive the outcome of the workflow in the broker response. See [zeebe/#2896](https://github.com/zeebe-io/zeebe/issues/2896) and [this blog post](https://zeebe.io/blog/2019/10/0.22-awaitable-outcomes/).
-   Support `ZEEBE_SECURE_CONNECTION` environment variable to enable TLS. See [#111](https://github.com/creditsenseau/zeebe-client-node-js/issues/111).
-   ZBClient and ZBWorker now extend `EventEmitter` and emit `ready` and `connectionError` events from their gRPC client channels. This is in addition to the existing callback handlers. See [#108](https://github.com/creditsenseau/zeebe-client-node-js/issues/108).
-   ZBClient now has a `completeJob` method that allows you to complete a job "manually", outside a worker. This allows you to decouple your job implementation from the service worker across a memory boundary - for example, in another AWS Lambda. Thanks to GitHub user MainAero for this. See [#112](https://github.com/creditsenseau/zeebe-client-node-js/pull/112).
-   The ZBLogger class is now available for you to instantiate a logger for application-level logging.

## Fixes

_Things that were broken and now are not._

-   Respect `ZEEBE_AUTHORIZATION_SERVER_URL` setting from the environment.
-   Correctly log task type from gRPC client in ZBLogger. See [#98](https://github.com/creditsenseau/zeebe-client-node-js/issues/98).
-   A message with no name would break `BpmnParser.generateConstantsForBpmnFiles`. Now it handles this correctly. Thanks to T.V. Vignesh for reporting this. See [#106](https://github.com/creditsenseau/zeebe-client-node-js/issues/106).
-   The `onReady` handler was not called for workers on initial start. Now it is. Thanks to Patrick Dehn for reporting this. See [#97](https://github.com/creditsenseau/zeebe-client-node-js/issues/97).

## Chores

_Internal house-keeping with no end-user impact._

-   Upgrade TypeScript to 3.7.
-   Upgrade Prettier to 1.19.1.

# Version 0.21.3

-   Feature: Enable gRPC heartbeat. The gRPC heartbeat is intended to stop proxies from terminating the gRPC connection. See [#101](https://github.com/creditsenseau/zeebe-client-node-js/issues/101).
-   Feature: gRPC channel logging now displays which worker the channel is for, or if it is for the ZBClient. See [#98](https://github.com/creditsenseau/zeebe-client-node-js/issues/98).
-   Chore: Upgrade [grpc](https://www.npmjs.com/package/grpc) dependency from 1.22.0 to 1.23.4
-   Security: Upgraded [typedoc](https://typedoc.org) dev dependency to 0.15.0, removing 8487 known vulnerabilities. Note that this package is used to build documentation and not installed in applications that depend on zeebe-node.

# Version 0.21.2

-   Fix: `ZBClient.close()` and `ZBWorker.close()` now return an awaitable Promise that guarantees the underlying gRPC channel is closed. It takes at least two seconds after jobs are drained to close the gRPC connection. When the `close` promise resolves, the gRPC channel is closed. Note that `ZBClient.close()` closes all workers created from that client.
-   Fix: Workers would stall for 180 seconds if they received a `504: Gateway Unavailable` error on the HTTP2 transport. This was incorrectly treated as a gRPC channel failure. The code now checks the state of the gRPC channel when a transport error is thrown, rather than assuming it has failed. See [#96](https://github.com/creditsenseau/zeebe-client-node-js/issues/96).
-   Feature: Log messages now include a `context` property with the stack frame that generated the log message.

# Version 0.21.1

-   Feature: `ZBClient.deployWorkflow()` now accepts an object containing a buffer. (Thanks Patrick Dehn!)
-   Fix: Pass stdout to ZBLogger and GRPCClient. (Thanks Patrick Dehn!)

# Version 0.21.0

-   Long-polling is now the default.
-   `connected` property added to ZBClient.
-   `onConnectionError()`, `onReady()`, and `connectionTolerance` added to ZBClient and ZBWorker.
-   gRPC retry on gRPC Error 8 (RESOURCE_EXHAUSTED) due to Broker Backpressure.
-   Deprecate `ZB_NODE_LOG_LEVEL`, add `ZEEBE_NODE_LOG_LEVEL`.

# Version 0.20.6

-   _BREAKING CHANGE_: Remove `complete()` in job handler callback. Use `complete.success()`.
-   Inject stdout to logger in GRPC client. Fixes [#74](https://github.com/creditsenseau/zeebe-client-node-js/issues/74).

# Version 0.20.5

-   Add support for the Zeebe service on Camunda Cloud.

# Version v0.20.1

-   Add long polling support. See [#64](https://github.com/creditsenseau/zeebe-client-node-js/issues/64).

# Version v0.20

-   Add TLS support (Thanks Colin from the Camunda Cloud Team!).
-   Remove node-grpc-client dependency.
-   Change versioning to match Broker versioning (Thanks Tim Colbert!).

# Version 2.4.0

-   Update for Zeebe 0.18.
-   Remove `ZBClient.listWorkflows` and `ZBClient.getWorkflow` - the broker no longer provides a query API.
-   Remove `{redeploy: boolean}` option from `ZBClient.deployWorkflow` method. This relies on `listWorkflows`. This will be the default behaviour in a future release of Zeebe. See [zeebe/#1159](https://github.com/zeebe-io/zeebe/issues/1159).
-   Add client-side retry logic. Retries ZBClient gRPC command methods on failure due to [gRPC error code 14](https://github.com/grpc/grpc/blob/master/doc/statuscodes.md) (Transient Network Error). See [#41](https://github.com/creditsenseau/zeebe-client-node-js/issues/40).

# Version 1.2.0

-   Integration tests in CI.
-   Fixed a bug with `cancelWorkflowInstance`.
-   Workers can now be configured to fail a workflow instance on an unhandled exception in the task handler.
-   Logging levels `NONE` | `ERROR` | `INFO` | `DEBUG` are configurable in the ZBClient.
-   Custom logging enabled by injecting Pino or compatible logger.
