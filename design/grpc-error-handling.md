# GRPC Channel Error Handling

There are a few things that can go wrong on the Grpc channel:

-   **No resolvable DNS address**. In this case, the stream emits an error with `code`: `14`, and `details`: `Name resolution failed for target nobroker:26500`.
-   **Resolvable address, but no broker**
-   **Broker goes away**. This can be due to a Docker restart, or a K8s pod reschedule (for example, in Camunda Cloud).
-   **Intermittent Network Error**
-   **Business Error**. For example:
-   **Broker backpressure**. This returns error code 8.
