# Development

## Publishing a new NPM Package

The NPM package publishing is handled by a GitHub Workflows using the [publish-to-npm](https://github.com/marketplace/actions/publish-to-npm) action.

To publish a new package, update the `package.json` package version and push a commit with the commit message "Release x.y.z" matching the package version.

## Disconnection test

There is a test that checks that the client can reconnect to a rescheduled broker, or a broker that starts after the client application.

It can be run with `npm run test:disconnection` and it is run automatically when committing changes. It requires Docker to be running on your machine.

## Debug logging

Try this for the insane level of trace logging:

```
DEBUG=grpc,worker GRPC_TRACE=all GRPC_VERBOSITY=DEBUG jest Worker-LongPoll --detectOpenHandles
```

To log from the Node engine itself (useful in tracking down grpc issues in grpc-js):

```
NODE_DEBUG=http2 GRPC_TRACE=channel,call_stream GRPC_VERBOSITY=DEBUG ZEEBE_NODE_LOGLEVEL=debug ZEEBE_NODE_PUREJS=true npm run test:integration
```
