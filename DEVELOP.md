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

To get extended stack traces:

```
NODE_DEBUG=http2 GRPC_TRACE=channel,call_stream ZEEBE_NODE_PUREJS=true node --expose-internals --expose-gc  node_modules/.bin/jest --runInBand --testPathIgnorePatterns disconnection --detectOpenHandles --verbose true Worker-Failure
```

```
valgrind node --expose-internals --expose-gc  node_modules/.bin/jest --runInBand --testPathIgnorePatterns disconnection --detectOpenHandles  Worker-Failure
```

## Scaffold a Ubuntu machine for dev

sudo apt install -y build-essential
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
source ~/.bashrc
nvm install 14
git clone https://github.com/camunda-community-hub/zeebe-client-node-js.git
cd zeebe-client-node-js
npm i

# Set Camunda Cloud env variables

ZEEBE_NODE_PUREJS=true node_modules/.bin/jest Worker-Failure
