# Version 2.4.0

• Update for Zeebe 0.18.
• Remove `ZBClient.listWorkflows` and `ZBClient.getWorkflow` - the broker no longer supports them.
• Remove `{redeploy: boolean}` option from `ZBClient.deployWorkflow` method. This relies on `listWorkflows`.
• Add `{retry: boolean}` to ZBClient constructor options. Defaults to true. Retries ZBClient gRPC command methods on failure. See [#40](https://github.com/creditsenseau/zeebe-client-node-js/issues/40).

# Version 1.2.0

• Integration tests in CI.
• Fixed a bug with `cancelWorkflowInstance`.
• Workers can now be configured to fail a workflow instance on an unhandled exception in the task handler.
• Logging levels `NONE` | `ERROR` | `INFO` | `DEBUG` are configurable in the ZBClient.
• Custom logging enabled by injecting Pino or compatible logger.
