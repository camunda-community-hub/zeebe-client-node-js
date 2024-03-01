# 8.3.2

## New Features

_New shiny stuff_

-   Added support for providing a value for a `scope` field in the OAuth request. This can be set with environment variable `ZEEBE_TOKEN_SCOPE`, or by passing a `scope` field as part of the `oAuth` config options for a `ZBClient`. This is needed to support OIDC / EntraID. Thanks to [@nikku](https://github.com/nikku) for the implementation. See PR [#363](https://github.com/camunda-community-hub/zeebe-client-node-js/pull/363) for more details.

# 8.3.1

## New Features

_New shiny stuff_

-   You can now deploy forms to the Zeebe broker using `ZBClient.deployResource()`. See [#332](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/332) for more details.

# 8.3.0

## Breaking changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   Several method signatures for `CreateProcessInstance` and `CreateProcessInstanceWithResult` have been removed, leaving only the method that takes an object parameter. See [#330](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/330#issuecomment-1672535320) for more details.

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   The `onConnectionError` event fires correctly for Camunda SaaS, but fires a false positive when connecting to a Self-Managed instance. See [#340](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/340) for more details.

## New Features

_New shiny stuff._

-   Camunda Platform 8.3.0 introduces multi-tenancy. To support this, the Node.js client adds an optional `tenantId` parameter to `DeployResource`, `DeployProcess`, `CreateProcessInstance`, `CreateProcessInstanceWithResult`, and `PublishMessage`. You can also specify a `tenantId` in the ZBClient constructor or via the environment variable `ZEEBE_TENANT_ID`. In the case that you specify it via the environment or constructor, it will be transparently added to all method invocations. See [#330](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/330) for more details.
-   `@grpc/grpc-js` has been updated to 1.9.7, and `@grpc/proto-loader` has been updated to 0.7.10.

_Things that were broken and are now fixed._

-   The `onReady` and `onConnection` event tests now pass, so these events should be usable. See [#215](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/215) for more details.

## Fixes

_Things that were broken and are now fixed._

-   An error message "Grpc Stream Error: 16 UNAUTHENTICATED: Failed to parse bearer token, see cause for details" would be logged intermittently. This was because under particular conditions an expired token cached on disk could be used for API calls. To prevent this, the disk-cached token is evicted at the same time as the in-memory token. See [#336](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/336) for more details.
-   The `onReady` and `onConnection` event tests now pass for Camunda SaaS. The `onReady` event fires correctly for Self-Managed started with docker-compose. See [#215](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/215) and [#340](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/340) for more details.

# Version 8.2.5

## New Features

_New shiny stuff._

-   Throwing a BPMN Error, either from the `ZBClient` or in the job handler of a `ZBWorker`, accepted an error message and an error code. The gRPC API for ThrowError now accepts a `variables` field, but the Node client did not allow you to set variables along with the error code and message. The Node client now accepts an object for `job.error` that includes a `variables` field, as does `ZBClient.throwError`, allowing you to set variables when throwing a BPMN error. See [#323](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/323), the README file, and the [Client API documentation](https://camunda-community-hub.github.io/zeebe-client-node-js/) for more details.

## Chores

_Things that shouldn't have a visible impact._

-   Unit tests used a unique process model for each test run. As a result, the number of deployed process models in a cluster increased over time until a SaaS cluster would fail due to sharding of the ElasticSearch. Unit tests have been refactored to reuse process models. This will have no impact for end-users, but for developers it means that you can use the same cluster for unit tests.

# Version 8.2.4

## Fixes

_Things that were broken and are now fixed._

-   Custom root certificates were not being passed to the Camunda SaaS OAuth provider. This caused a failure to connect when an SSL terminating firewall that uses a custom root certificate sits between the client and Camunda SaaS. Custom root certificates are now passed to the Camunda SaaS OAuth provider, and are used when making the connection. Thanks to [@nikku](https://github.com/nikku) for reporting this and providing the patch. See [#319](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/319) for more details.

# Version 8.2.3

## Fixes

_Things that were broken and are now fixed._

-   The object signature for `job.fail()` did not correctly apply an explicit value for `retries`. As a result, job retries would decrement automatically if this signature and option were used. The value is now correctly parsed and applied, and job retry count can be explicitly set in the `job.fail()` command with the object signature. Thanks to [@patozgg](https://github.com/patozgg) for reporting this. See [#316](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/316) for more details.

# Version 8.2.2

## Chores

_Things that shouldn't have a visible impact._

-   Updated `uuid` dependency from v3 to v7. This avoids a warning message at install time that "versions prior to 7 may use `Math.random()`".

# Version 8.2.1

## New Features

_New shiny stuff._
-   Add `ZBClient.broadcastSignal`, enabling the client to broadcast a signal. See [#312](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/312) for more details.

## Fixes

_Things that were broken and are now fixed._

-   Previously, the `timeToLive` property of `ZBClient.publishMessage` was required, although it was documented as optional. In this release, both `timeToLive` and `variables` have been made optional. If no value is supplied for `timeToLive`, it defaults to 0. Thanks to [@nhomble]() for raising this issue. See [#311](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/311) for more details.

# Version 8.2.0

## New Features

_New shiny stuff._
-   Add `ZBClient.evaluateDecision`, enabling a DMN table to be evaluated on a Zeebe 8.2 and later broker. See [#296](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/296) for more details.

# Version 8.1.8

## Fixes

_Things that were broken and are now fixed._

-  The OAuth token was being evicted from the in-memory cache immediately, resulting in the file cache being used for every request. This release correctly sets the expiry time for the in-memory token cache. See [#307](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/307) for more details. Thanks to [@walliee](https://github.com/Walliee) for the fix.

# Version 8.1.7

## Fixes

_Things that were broken and are now fixed._

-   With `cacheOnDisk` disabled, the OAuthProvider could cause excessive requests to the token endpoint, leading to blacklisting and denial-of-service. This version makes several adjustments to mitigate this: it caches the token in memory, reuses a single inflight request to the token endpoint, and backs off the token endpoint on a request failure. See [#301](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/301) for more details. Thanks to [@nhomble](https://github.com/nhomble) for raising this issue.

# Version 8.1.6

## Chores

_Things that shouldn't have a visible impact._

-   Bump `fast-xml-parser` to 4.1.3 to address [SNYK-JS-FASTXMLPARSER-3325616](https://security.snyk.io/vuln/SNYK-JS-FASTXMLPARSER-3325616). Thanks to [@barmac](https://github.com/barmac) for the patch.

# Version 8.1.5

## New Features

_New shiny stuff._

-   The ZBClient now implements the `modifyProcessInstance` API, introduced in Zeebe 8.1. This allows you to modify a running process instance, moving execution tokens and changing variables. This can be used, for example, to migrate a running process instance to a new version of the process model. See [#294](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/294) for more details.
-   The ZBClient `createProcessInstance` method now allows you to specify `startInstructions` (introduced in Zeebe 8.1), allowing you to start a new process instance from an arbitrary point. Along with `modifyProcessInstance`, this is a powerful primitive for building migration functionality. See [[#295](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/295)] for more details.

# Version 8.1.4

## Fixes

_Things that were broken and are now fixed._

-   The @grpc dependencies are now pinned to a specific version - 1.8.7 for grpc-js and 0.7.4 for proto-loader. This is to avoid broken upstream dependencies impacting installs. Previously, with the dependency unpinned, an install on different days could result in a library that worked, or did not work, depending on the state of the upstream libraries. Now, the same dependencies are installed every time, resulting in a consistent experience. Thanks to [@nikku](https://github.com/nikku) and [@barmac](https://github.com/barmac) from the [Camunda Modeler](https://github.com/camunda/camunda-modeler) team for identifying this. See [#290](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/290) for more context.
-   The `docker` subdirectory is back, with a `docker-compose.yml` file to start a local broker for testing purposes. See [#289](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/289) for more details.

## New Features

_New shiny stuff._

-   A custom SSL certificate is now able to be used for the oAuth endpoint. The `got` library used for the token exchange needs the certificate explicitly, and it can now be passed in as a `customRootCert` property to the `oAuth` property in the ZBClient constructor. Thanks to [luca-waldmann-cimt](https://github.com/luca-waldmann-cimt) for the feature. See [#284](https://github.com/camunda-community-hub/zeebe-client-node-js/pull/284) for more details.

# Version 8.1.2

## Fixes

_Things that were broken and are now fixed._

-   In 8.1.1, the update to the version of `got` introduced a regression that broke the OAuth token request with certain gateway configurations. This is now reverted, and a test has been introduced to ensure this regression does not happen again. See [#280](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/280) for more details.

## New Features

_New shiny stuff._

-   Applications can now extend the user agent identifier by setting a value for the environment variable `ZEEBE_CLIENT_CUSTOM_AGENT_STRING`. This will be appended to the standard user agent string. See [#279](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/279) for more details.

# Version 8.1.1

## Chores

_Things that shouldn't have a visible impact._

-   Bump got to 11.8.5 to fix [CVE-2022-33987](https://github.com/advisories/GHSA-pfrx-2q88-qq97). Thanks to [@nithinssabu](https://github.com/nithinssabu) for the PR. See [#275](https://github.com/camunda-community-hub/zeebe-client-node-js/pull/275) for more detail.

# Version 8.1

## Breaking changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   Remove all deprecated APIs. All methods and interfaces that were marked as deprecated in the 1.3.0 release have been removed. All support for application code using the pre-1.0 Zeebe API is now gone. You will need to update your application code to refactor the deprecated methods and interfaces, or stay on version 8.0.3 of the package.

## Fixes

_Things that were broken and are now fixed._

-   Previously, the `connectionTolerance` option to `createWorker` did not take a `MaybeTimeDuration`, requiring users to provide a number (the value units is milliseconds). The signature has now been fixed, and `connectionTolerance` can now take a number or a typed Duration. See [#260](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/260) for more detail. Thanks to [@dancrumb](https://github.com/dancrumb) for reporting this.
-   Previously, the autogenerated code for a BPMN model used the deprecated worker constructor and did not return the job acknowledgement token. It now uses the object constructor and correctly returns the job acknowledgement token. See [#257](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/257) for more details. Thanks to [@megankirkbride](https://github.com/megankirkbride) for reporting this issue.
-   Previously, the OAuth token request sent by the library used JSON encoding. This worked with Camunda SaaS, but would fail with Keycloak in self-managed. The library now correctly encodes the request as x-www-form-urlencoded. See [#272](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/272) for more details. Thanks to [@AdrianErnstLGLN](https://github.com/AdrianErnstLGLN) for reporting this issue and providing a patch.

# Version 8.0.3

## Fixes

_Things that were broken and are now fixed._

-   Previously, the `fetchVariable` option passed to `createWorker` had no effect. All variables were always fetched by workers. This option setting is now respected, allowing you to constrain the variables fetched by workers. See [#264](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/264) for details. Thanks to [@Veckatimest](https://github.com/Veckatimest) for reporting this.

# Version 8.0.2

## Fixes

_Things that were broken and are now fixed._

-   Custom SSL certificates configured via environment variables now work correctly. See [PR #263](https://github.com/camunda-community-hub/zeebe-client-node-js/pull/263) for the details. Thanks to [@barmac](https://github.com/barmac) for the PR.

# Version 8.0.0

Version 8.0.0 is the release to support Camunda Platform 8. The semver change does not denote a breaking API change. It's a product marketing alignment, rather than a technical semver change.

## New Features

_New shiny stuff._

-   Zeebe 8.0.0 and later support an optional retry backoff for failed jobs. This is a communication to the broker about how long it should delay before making the job available for activation again. This is implemented as a new interface for `job.fail`. See [[#248](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/248)] for more details.

# Version 2.4.0

## Breaking changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The C-based gRPC implementation has been removed in this release. It is unmaintained, and does not build with Node 17. The Zeebe Node client now uses the pure JS gRPC implementation and requires Node version 12.22.5+, 14.17.5+, or 16.6.1+. See [#201](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/201) and [#247](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/247) for more details.

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   The `onConnectionError` and `onReady` events do not work as expected. Applications that rely on these should not upgrade until this is fixed. See [#215](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/215).

# Version 1.3.5

## Fixes

_Things that were broken and are now fixed._

-   Incident resolution via `ZBClient.resolveIncident()` now works. Thanks to [mrsateeshp](https://github.com/mrsateeshp) for the Pull Request. See [#242](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/242) for more details.
-   Auth token retries now have an automatic back-off to avoid saturating the endpoint and getting blacklisted if invalid credentials are supplied. See [#244](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/244) for more details.

# Version 1.3.3

## Breaking changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   Previously, you could pass an entire URL to the `clusterId` field in the `camundaCloud` option in the `ZBClient` constructor. The library would parse this and extract the cluster ID. With the changes to support multiple regions, this no longer works. From version 1.4.0, you must pass in only the cluster Id, not the complete URL. See [#232](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/232).

## New Features

_New shiny stuff._

-   With Camunda Cloud 1.1, the DNS schema for the hosted service has been upgraded to include regions. To support this, the `camundaCloud` object in the ZBClient constructor now has an optional `clusterRegion` field. When no value is specified it defaults to `bru-2` (Belgium). See [#232](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/232).

## Chores

_Things that shouldn't have a visible impact._

-   Package dependencies have been updated to pass Snyk vulnerability scanning and `npm audit report`.
-   Husky has been updated to version 7.

# Version 1.3.2

## Fixes

_Things that were broken and are now fixed._

-   Setting `maxRetries` and `maxRetryTimeout` in the ZBClient constructor had no effect. Only setting the environment variables `ZEEBE_CLIENT_MAX_RETRIES` and `ZEEBE_CLIENT_MAX_RETRY_TIMEOUT` had an effect. Now, the constructor options take effect. The constructor options will be overridden by the environment variables if those are set. See [#228](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/228).

# Version 1.3.1

## Fixes

_Things that were broken and are now fixed._

-   The user agent was added to requests for an OAuth token, but not for gRPC calls. It is now set in the gRPC call metadata for all gRPC calls. Thanks to [@zelldon](https://github.com/Zelldon) for opening the issue and helping track it down. See [#225](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/225).

# Version 1.3.0

## Note on Version Number

Versions 1.0 - 1.2 were released two years ago, under the old numbering scheme. Version 1.3.0 is the Node client release that supports Camunda Cloud 1.0 and Zeebe 1.0.

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   `onReady` and `onConnectionError` events are not firing reliably. At the moment, the `onConnectionError` is called even when a gateway is present and accessible, and `onReady` is not called. See [#215](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/215).
-   The TLS connection does not work with self-managed Zeebe brokers secured with TLS. See [#218](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/218) and [#219](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/219).
-   An exception in the gRPC layer can cause an application to exit. The workaround for this at the moment is to add a handler on the process for uncaught exceptions. See [#217](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/217).

## Breaking changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The Zeebe API has changed in 1.0.0 and uses a gRPC protocol that is incompatible with pre-1.0.0 brokers. _The 1.0.0 package will not work with a pre-1.0.0 broker_. Nor will a pre-1.0.0 version of `zeebe-node` work with a 1.0.0 broker. See [#208](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/208).
-   The worker task handler has a new type signature: `job => Promise<JOB_ACTION_ACKNOWLEDGEMENT>`. This means that all code branches in the worker handler must return a `complete` method call (deprecated), or one of the new `job.complete`, `job.fail`, `job.error`, `job.forward`, or `job.cancelWorkflowInstance` methods. This signature means that the type system can now do an exhaustiveness check to detect code paths that will always time out in the worker. See [#210](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/210).

## Deprecations

_Things that are deprecated and will be removed in a future release. Existing code will work for now, but should be migrated at some point. New code should not use these features._

-   The previous methods with the word `workflow` in them (e.g.: `deployWorkflow`, `startWorkflowInstance`) are deprecated. In the 1.0.0 package they transparently call the new methods with `process` in them (e.g.: `deployProcess`, `startProcessInstance`), so existing code does not need to be rewritten. However, new code should not use these deprecated methods. These methods are scheduled to be removed in whichever comes first: the 1.2.0 release, or three months from the release of the 1.0.0 release. See [#208](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/208).
-   The `complete` parameter in the worker task handler callback is deprecated, and will be removed in a future release. Use the new methods on the `job` object instead.
-   The non-object constructors for `createWorker` are deprecated, and will be removed in a future release. Use the object constructor instead.

## New Features

_New shiny stuff._

-   The worker task handler now has a new signature: `job => Promise<JOB_ACTION_ACKNOWLEDGEMENT>`. The `complete` parameter is deprecated, and the job object now has the methods `job.complete`, `job.fail`, `job.error`, `job.forward`. See [#209](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/209).
-   The `job` object has a new method `job.cancelWorkflowInstance`. This allows you to cancel a workflow from within a worker, and return a `Promise<JOB_ACTION_ACKNOWLEDGEMENT>` in the worker handler. See [#211](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/211).
-   Attempting to call two outcome methods on a job (for example: `job.complete()` and `job.fail()`, or the deprecated `complete.success()` and `complete.error()`) will now log an error to the console, alerting you to the behaviour and identifying the task type of the worker. See [#213](https://github.com/camunda-community-hub/zeebe-client-node-js/issues/213).

# Version 0.26.0

## New Features

_New shiny stuff._

-   Upgraded the `grpc`, `@grpc/grpc-js` and `@grpc/proto` dependencies to the latest releases.

## Breaking Changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The type of the `complete.success` parameter is changed from `Partial<T>` to `T`. This gives you an exhaustive check on this function in a typed worker. If you use the type parameters on `createWorker` and your code relies on the previous optional nature of the payload fields, you will need to change the type signature in your code. See [#198](https://github.com/zeebe-io/zeebe-client-node-js/issues/198)

## Fixes

_Things that were broken and are now fixed._

-   A broken link in the README TOC is fixed. Thanks to [@nwittstruck](https://github.com/nwittstruck) for the PR! See [#200](https://github.com/zeebe-io/zeebe-client-node-js/pull/200).

# Version 0.25.1

## New Features

_New shiny stuff._

-   The library now supports connecting to a gateway that has a self-signed certificate. See the TLS section of the README for details on configuration. See [#160](https://github.com/zeebe-io/zeebe-client-node-js/issues/160).
-   Client-side retries are now configurable via the environment variables `ZEEBE_CLIENT_MAX_RETRIES`, `ZEEBE_CLIENT_RETRY`, and `ZEEBE_CLIENT_MAX_RETRY_TIMEOUT`. Thanks to [@jaykanth6](https://github.com/jaikanth6) for the [implementation](https://github.com/zeebe-io/zeebe-client-node-js/issues/157).

-   The Generic types used for parameterising the Client and Worker have been renamed to improve the intellisense. Previously, the `WorkflowVariables`, `CustomHeaders`, and `OutputVariables` type parameters were aliased to `KeyedObject`. In VSCode, these all displayed in intellisense as `KeyedObject`, losing the semantics of each parameter. They now display in intellisense with the type parameter name.

# Version 0.25.0

## Fixes

_Things that were broken and are now fixed._

-   Workers would intermittently throw an unhandled exception, and in some cases disconnect from Camunda Cloud. This was caused by network errors throwing an error event on the stream after the end event was emitted and all listeners were removed. The error event listener is no longer removed when the end event is received, and the worker no longer throws an unhandled exception. See [#99}(https://github.com/zeebe-io/zeebe-client-node-js/issues/99).

# Version 0.24.2

## Fixes

_Things that were broken and are now fixed._

-   The example code in `example` is updated to remove a deprecated method. See [#185](https://github.com/zeebe-io/zeebe-client-node-js/issues/185).
-   An race condition in the ZBBatchWorker that could cause jobs to be lost in certain specific and rare race conditions has been refactored. See [#177](https://github.com/zeebe-io/zeebe-client-node-js/issues/177)
-   The `onConnectionError` event is now debounced. See [#161](https://github.com/zeebe-io/zeebe-client-node-js/issues/161).

# Version 0.24.0

## Fixes

_Things that were broken and are now fixed._

-   The `segfault-handler` package dependency broke cross-architecture builds. This required users to change their build chain and caused issues with AWS lambda deployment. It was added to assist in debugging the pure JS implementation of gRPC. In this release it has been removed. See [#173](https://github.com/zeebe-io/zeebe-client-node-js/issues/173).

# Version 0.23.3

## Breaking Changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   This version goes back to the C-based gRPC implementation. We found several issues with the pure JS gRPC implementation and the nghttp2 implementation in Node. The issues differ between Node versions, and are challenging to isolate, as they occur in the Node engine itself. By default, in this version, the Zeebe Node client uses the C-based gRPC client. If you want to participate in testing the pure JS client (bug reports welcome!), you can activate the pure JS gRPC client by setting `ZEEBE_NODE_PUREJS=true`.
-   Prior to this release, the default value for `maxRetries` was 50 (about 2 minutes). This caused workers started more than 2 minutes before the broker to abandon connection attempts and fail to connect. With this release, retries are infinite by default.

# Version 0.23.2

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   Node 12 has issues with the new pure JS implementation. We don't have a compatibility matrix yet, but Node 14 works.
-   The `onConnectionError` event of the ZBClient and ZBWorker/ZBBatchWorker is not debounced, and may be called multiple times in succession when the channel jitters, or the broker is not available. See [#161](https://github.com/zeebe-io/zeebe-client-node-js/issues/161).

## Fixes

_Things that were broken and are now fixed._

-   The client's gRPC channel would not reconnect if a Zeebe broker in Docker is restarted. The `@grpc/grpc-js` package is updated to 1.0.4 to bring in the fix for [@grpc/grpc-js #1411](https://github.com/grpc/grpc-node/issues/1411). This enables the client to reliably reconnect to brokers that are restarted in Docker or rescheduled in Kubernetes.

# Version 0.23.2

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   The `onConnectionError` event of the ZBClient and ZBWorker/ZBBatchWorker is not debounced, and may be called multiple times in succession when the channel jitters, or the broker is not available. See [#161](https://github.com/zeebe-io/zeebe-client-node-js/issues/161).

## Fixes

_Things that were broken and are now fixed._

-   The `dist` directory is now in the published package. Thanks to [@lwille](https://github.com/lwille) for the PR that fixed the build. See [#163](https://github.com/zeebe-io/zeebe-client-node-js/issues/163).

# Version 0.23.0

## Known Issues

_Things that don't work or don't work as expected, and which will be addressed in a future release_

-   There is no `dist` directory in this release. See [#163](https://github.com/zeebe-io/zeebe-client-node-js/issues/163), and _do not use this release_.
-   The `onConnectionError` event of the ZBClient and ZBWorker/ZBBatchWorker is not debounced, and may be called multiple times in succession when the channel jitters, or the broker is not available. See [#161](https://github.com/zeebe-io/zeebe-client-node-js/issues/161).

## Breaking Changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The `job.variables` and `job.customHeaders` in the worker job handler are now typed as read-only structures. This will only be a breaking change if your code relies on mutating these data structures. See the section "Working with Workflow Variables and Custom Headers" in the README for an explanation on doing deep key updates on the job variables.
-   The ZBClient no longer eagerly connects to the broker by default. Previously, it did this by issuing a topology command in the constructor. This allows you an onReady event to be emitted. You can re-enable the eager connection behavior, by either passing `eagerConnection: true` to the client constructor options, or setting the environment variable `ZEEBE_NODE_EAGER_CONNECTION` to `true`. See [#151](https://github.com/zeebe-io/zeebe-client-node-js/issues/151).
-   The library nows logs with the simplified `ZBSimpleLogger` by default, for friendly human-readable logs. This will only be a breaking change if you currently rely on the structured log output. To get the previous structured log behaviour, pass in `stdout: ZBJsonLogger` to the `ZBClient` constructor options, or set the environment variable `ZEEBE_NODE_LOG_TYPE` to `JSON`. Refer to the "Logging" section in the README.

## New Features

_New shiny stuff._

-   The underlying gRPC implementation has been switched to the pure JS @grpc/grpc-js. This means no more dependency on node-gyp or binary rebuilds for Docker containers / Electron; and a slim-down in the installed package size from 50MB to 27MB. All tests pass, including some new ones (for example: the worker keeps working when the broker goes away and comes back). The JS gRPC implementation _may_ have effects on the behaviour of the client that are not covered in the unit and integration tests. Please open a GitHub issue if you encounter something.
-   Timeouts can now be expressed with units using the [typed-duration](https://www.npmjs.com/package/typed-duration) package, which is included in and re-exported by the library. See the README section "A note on representing timeout durations".
-   There is a new `ZBBatchWorker`. This allows you to batch jobs that are unrelated in a BPMN model, but are related with respect to some (for example: rate-limited) external system. See the README for details. Thanks to Jimmy Beaudoin ([@jbeaudoin11](https://github.com/jbeaudoin11)) for the suggestion, and helping with the design. Ref: [#134](https://github.com/zeebe-io/zeebe-client-node-js/issues/134).
-   `ZBClient.createWorker` has two new, additional, method signature. The first is a single object parameter signature. This is the preferred signature if you are passing in configuration options. The second signature is a version of the original that elides the `id` for the worker. With this, you can create a worker with just a task type and a job handler. A UUID is assigned as the worker id. This is the equivalent of passing in `null` as the first parameter to the original signature. The previous method signature still works, allowing you to specify an id if you want. See [this article for details](https://www.joshwulf.com/blog/2020/02/refining-method-signature/).
-   There is now a `ZBLogMessage` interface to help you implement a custom logger [#127](https://github.com/zeebe-io/zeebe-client-node-js/issues/127). For an example of a custom logger, see the [Zeebe GitHub Action implementation](https://github.com/jwulf/zeebe-action/blob/master/src/log/logger.ts).
-   There is new custom logger implementation `ZBSimpleLogger` that produces flat string output. If you are not interested in structured logs for analysis, this log is easier for humans to read.
-   `ZBClient` now contains an `activateJobs` method. This effectively exposes the entire Zeebe GRPC API, and allows you to write applications in the completely unmanaged style of the Java and Go libraries, if you have some radically different idea about application patterns.
-   The Grpc layer has been refactored to implement the idea of "connection characteristics". When connecting to Camunda Cloud, which uses TLS and OAuth, the library would emit errors every time. The refactor allows these connection errors to be correctly interpreted as expected behaviour of the "connection characteristics". You can also set an explicit initial connection tolerance in milliseconds for any broker connection with the environment variable `ZEEBE_INITIAL_CONNECTION_TOLERANCE`. See [this article](https://www.joshwulf.com/blog/2020/03/camunda-cloud-connection-2/), issue [#133](https://github.com/zeebe-io/zeebe-client-node-js/issues/133), and the README section "Initial Connection Tolerance" for more details.
-   The connection tolerance for transient drop-outs before reporting a connection error is now configurable via the environment variable `ZEEBE_CONNECTION_TOLERANCE`, as well as the previous constructor argument `connectionTolerance`.
-   The Node client now emits a client-agent header to facilitate debugging on Camunda Cloud. See [#155](https://github.com/zeebe-io/zeebe-client-node-js/issues/155).
-   The integration tests have been refactored to allow them to run against Camunda Cloud. This required dealing with a Zeebe broker in an unknown state, so all tests now template unique process ids, unique task types, and unique message names to avoid previous test run state in the cluster interfering with subsequent test runs.
-   I've started documenting the internal operation of the client in BPMN diagrams. These can be found in the `design` directory.
-   The README now contains a section "Writing Strongly-typed Job Workers", on writing typed workers in TypeScript.
-   The README also has a shiny TOC. It has grown in size such that one is needed.

## Fixes

_Things that were broken and are now fixed._

-   An unmaintained package in the dependency tree of kafka-node (and arguably a bug in NPM's de-duping algorithm) caused zeebe-node to break by installing the wrong version of the `long` dependency, unless the two packages were installed in a specific order. We've explicitly added `long` to the dependencies of zeebe-node to address this, and [reported it to kafka-node](https://github.com/SOHU-Co/kafka-node/issues/1332). Thanks to [@need4eat](https://github.com/need4eat) for discovering this and helping to track down the cause. See [#124](https://github.com/zeebe-io/zeebe-client-node-js/issues/124).
-   Prior to 0.23.0 of the zeebe-node client, a worker would not reconnect if the broker was restarted, throwing gRPC channel errors until they were restarted. A stalled retry timer has been added to the worker. The worker will now automatically reconnect when the broker is available, if it goes away and comes back. See [#99](https://github.com/zeebe-io/zeebe-client-node-js/issues/99), [#145](https://github.com/zeebe-io/zeebe-client-node-js/issues/145), and [#152](https://github.com/zeebe-io/zeebe-client-node-js/issues/152).

# Version 0.22.1

## Breaking Changes

_Changes in APIs or behaviour that may affect existing applications that use zeebe-node._

-   The default job activation timeout for the ZBWorker has been changed from 1s to 60s.
-   The signature for specifying a workflow definition version in `createWorkflowInstance` has changed. See the README for the new signature.
-   If the oAuth `cacheOnDisk` is true and the directory `$HOME/.camunda` is not writable, then the ZBClient constructor will now throw to prevent unbounded token requests. Thanks to GitHub user MainAero for reporting this. See [#110](https://github.com/zeebe-io/zeebe-client-node-js/issues/110).
-   Change default long poll for workers to 30s. See [#101](https://github.com/zeebe-io/zeebe-client-node-js/issues/101).
-   The ZBClient no longer bubbles up gRPC status from its workers. See [#109](https://github.com/zeebe-io/zeebe-client-node-js/issues/109) and [this comment](https://github.com/zeebe-io/zeebe-client-node-js/issues/99#issuecomment-554926818).
-   Remove `pollMode` (it's now always long-poll), and add `pollInterval` in ZBLogger messages.

## New Features

_New shiny stuff._

-   You can now throw a BPMN Error in your process from a worker using the `complete.error(errorCode: string, errorMessage?: string)` method, or from the client using the `ZBClient.throwError(throwErrorRequest: ThrowErrorRequest)` method.
-   If you install the package globally with `npm i -g zeebe-node`, you get the command `zeebe-node <filename>` that parses a BPMN file and emits type definitions.
-   The oAuth token cache directory is now configurable via the ZBClient constructor parameter `oAuth.cacheDir` or the environment variable `ZEEBE_TOKEN_CACHE_DIR`.
-   Add support for Basic Auth. See [this commit](https://github.com/jwulf/zeebe-client-node-js/commit/bd261a7417d68ff9c6739b3057a042aaade7eb4a) and the README for details.
-   Awaitable workflow outcome. With a 0.22 broker, the client can initiate a workflow and receive the outcome of the workflow in the broker response. See [zeebe/#2896](https://github.com/zeebe-io/zeebe/issues/2896) and [this blog post](https://zeebe.io/blog/2019/10/0.22-awaitable-outcomes/).
-   Support `ZEEBE_SECURE_CONNECTION` environment variable to enable TLS. See [#111](https://github.com/zeebe-io/zeebe-client-node-js/issues/111).
-   ZBClient and ZBWorker now extend `EventEmitter` and emit `ready` and `connectionError` events from their gRPC client channels. This is in addition to the existing callback handlers. See [#108](https://github.com/zeebe-io/zeebe-client-node-js/issues/108).
-   ZBClient now has a `completeJob` method that allows you to complete a job "manually", outside a worker. This allows you to decouple your job implementation from the service worker across a memory boundary - for example, in another AWS Lambda. Thanks to GitHub user MainAero for this. See [#112](https://github.com/zeebe-io/zeebe-client-node-js/pull/112).
-   The ZBLogger class is now available for you to instantiate a logger for application-level logging.

## Fixes

_Things that were broken and now are not._

-   Respect `ZEEBE_AUTHORIZATION_SERVER_URL` setting from the environment.
-   Correctly log task type from gRPC client in ZBLogger. See [#98](https://github.com/zeebe-io/zeebe-client-node-js/issues/98).
-   A message with no name would break `BpmnParser.generateConstantsForBpmnFiles`. Now it handles this correctly. Thanks to T.V. Vignesh for reporting this. See [#106](https://github.com/zeebe-io/zeebe-client-node-js/issues/106).
-   The `onReady` handler was not called for workers on initial start. Now it is. Thanks to Patrick Dehn for reporting this. See [#97](https://github.com/zeebe-io/zeebe-client-node-js/issues/97).

## Chores

_Internal house-keeping with no end-user impact._

-   Upgrade TypeScript to 3.7.
-   Upgrade Prettier to 1.19.1.

# Version 0.21.3

-   Feature: Enable gRPC heartbeat. The gRPC heartbeat is intended to stop proxies from terminating the gRPC connection. See [#101](https://github.com/zeebe-io/zeebe-client-node-js/issues/101).
-   Feature: gRPC channel logging now displays which worker the channel is for, or if it is for the ZBClient. See [#98](https://github.com/zeebe-io/zeebe-client-node-js/issues/98).
-   Chore: Upgrade [grpc](https://www.npmjs.com/package/grpc) dependency from 1.22.0 to 1.23.4
-   Security: Upgraded [typedoc](https://typedoc.org) dev dependency to 0.15.0, removing 8487 known vulnerabilities. Note that this package is used to build documentation and not installed in applications that depend on zeebe-node.

# Version 0.21.2

-   Fix: `ZBClient.close()` and `ZBWorker.close()` now return an awaitable Promise that guarantees the underlying gRPC channel is closed. It takes at least two seconds after jobs are drained to close the gRPC connection. When the `close` promise resolves, the gRPC channel is closed. Note that `ZBClient.close()` closes all workers created from that client.
-   Fix: Workers would stall for 180 seconds if they received a `504: Gateway Unavailable` error on the HTTP2 transport. This was incorrectly treated as a gRPC channel failure. The code now checks the state of the gRPC channel when a transport error is thrown, rather than assuming it has failed. See [#96](https://github.com/zeebe-io/zeebe-client-node-js/issues/96).
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
-   Inject stdout to logger in GRPC client. Fixes [#74](https://github.com/zeebe-io/zeebe-client-node-js/issues/74).

# Version 0.20.5

-   Add support for the Zeebe service on Camunda Cloud.

# Version v0.20.1

-   Add long polling support. See [#64](https://github.com/zeebe-io/zeebe-client-node-js/issues/64).

# Version v0.20

-   Add TLS support (Thanks Colin from the Camunda Cloud Team!).
-   Remove node-grpc-client dependency.
-   Change versioning to match Broker versioning (Thanks Tim Colbert!).

# Version 2.4.0

-   Update for Zeebe 0.18.
-   Remove `ZBClient.listWorkflows` and `ZBClient.getWorkflow` - the broker no longer provides a query API.
-   Remove `{redeploy: boolean}` option from `ZBClient.deployWorkflow` method. This relies on `listWorkflows`. This will be the default behaviour in a future release of Zeebe. See [zeebe/#1159](https://github.com/zeebe-io/zeebe/issues/1159).
-   Add client-side retry logic. Retries ZBClient gRPC command methods on failure due to [gRPC error code 14](https://github.com/grpc/grpc/blob/master/doc/statuscodes.md) (Transient Network Error). See [#41](https://github.com/zeebe-io/zeebe-client-node-js/issues/40).

# Version 1.2.0

-   Integration tests in CI.
-   Fixed a bug with `cancelWorkflowInstance`.
-   Workers can now be configured to fail a workflow instance on an unhandled exception in the task handler.
-   Logging levels `NONE` | `ERROR` | `INFO` | `DEBUG` are configurable in the ZBClient.
-   Custom logging enabled by injecting Pino or compatible logger.
