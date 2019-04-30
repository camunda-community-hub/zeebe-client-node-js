# Version 1.2.0

• Integration tests in CI.
• Fixed a bug with `cancelWorkflowInstance`.
• Workers can now be configured to fail a workflow instance on an unhandled exception in the task handler.
• Logging levels `NONE` | `ERROR` | `INFO` | `DEBUG` are configurable in the ZBClient.
• Custom logging enabled by injecting Pino or compatible logger.
