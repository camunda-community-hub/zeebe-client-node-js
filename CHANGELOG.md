# Version 0.22.0

-   Breaking Change: the signature for specifying a workflow definition version in `createWorkflowInstance` has changed. See the README for the new signature.
-   Feature: Awaitable workflow outcome. The client can initiate a workflow and receive the outcome of the workflow in the response. See [zeebe/#2896](https://github.com/zeebe-io/zeebe/issues/2896).
-   Change default long poll to 30s. See [#101](https://github.com/creditsenseau/zeebe-client-node-js/issues/101).
-   Fix: Correctly log task type from gRPC client.
-   Change `pollMode` to `pollInterval` in logging.

# Version 0.21.3

-   Feature: Enable gRPC heartbeat. The gRPC heartbeat is intended to stop proxies from terminating the gRPC connection. See [#101](https://github.com/creditsenseau/zeebe-client-node-js/issues/101).
-   Feature: gRPC channel logging now displays which worker the channel is for, or if it is for the ZBClient. See [#98](https://github.com/creditsenseau/zeebe-client-node-js/issues/98).
-   Chore: Upgrade [grpc](https://www.npmjs.com/package/grpc) dependency from 1.22.0 to 1.23.4
-   Security: Upgraded [typedoc](https://typedoc.org) dev dependency to 0.15.0, removing 8487 known vulnerabilities. Note that this package is used to build documentation and not installed in applications that depend on zeebe-node.

# Version 0.21.2

-   Fix: `ZBClient.close()` and `ZBWorker.close()` now return an awaitable Promise that guarantees the underlying gRPC channel is closed. It takes at least two seconds after jobs are drained to close the gRPC connection. When the `close` promise resolves, the gRPC channel is closed. Note that `ZBClient.close()` closes all workers created from that client.
-   Fix: Workers would stall for 180 seconds if they received a 504: Gateway Unavailable error on the HTTP2 transport. This was incorrectly treated as a gRPC channel failure. The code now checks the state of the gRPC channel when a transport error is thrown, rather than assuming it has failed. See [#96](https://github.com/creditsenseau/zeebe-client-node-js/issues/96).
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

• Add long polling support. See [#64](https://github.com/creditsenseau/zeebe-client-node-js/issues/64).

# Version v0.20

• Add TLS support (Thanks Colin from the Camunda Cloud Team!).
• Remove node-grpc-client dependency.
• Change versioning to match Broker versioning (Thanks Tim!).

# Version 2.4.0

• Update for Zeebe 0.18.
• Remove `ZBClient.listWorkflows` and `ZBClient.getWorkflow` - the broker no longer provides a query API.
• Remove `{redeploy: boolean}` option from `ZBClient.deployWorkflow` method. This relies on `listWorkflows`. This will be the default behaviour in a future release of Zeebe. See [zeebe/#1159](https://github.com/zeebe-io/zeebe/issues/1159).
• Add client-side retry logic. Retries ZBClient gRPC command methods on failure due to [gRPC error code 14](https://github.com/grpc/grpc/blob/master/doc/statuscodes.md) (Transient Network Error). See [#41](https://github.com/creditsenseau/zeebe-client-node-js/issues/40).

# Version 1.2.0

• Integration tests in CI.
• Fixed a bug with `cancelWorkflowInstance`.
• Workers can now be configured to fail a workflow instance on an unhandled exception in the task handler.
• Logging levels `NONE` | `ERROR` | `INFO` | `DEBUG` are configurable in the ZBClient.
• Custom logging enabled by injecting Pino or compatible logger.
