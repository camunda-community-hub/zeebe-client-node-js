# Version v0.21

• Add long polling support. See [#64](https://github.com/creditsenseau/zeebe-client-node-js/issues/64).
• @TODO: Add authentication via JWT.

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
