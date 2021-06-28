# Development

_Development conventions._

## Creating a new branch

Please create a new branch for each feature or fix, and branch from `master`.

## Precommit hooks

There is a precommit hook that runs the disconnection test, which requires Docker to be installed and for no Zeebe container to be running.

## Commit messages

We use [AngularJS's commit message conventions](https://github.com/angular/angular.js/blob/master/DEVELOPERS.md#-git-commit-guidelines), enforced by [commitizen](https://github.com/commitizen/cz-cli). This is used by [semantic-release](https://www.npmjs.com/package/semantic-release) to automate releases to NPM when PRs are merged into master.

Run `git commit` without the `-m` flag to get a wizard that will guide you through creating an appropriate commit message.

## Pull Requests

Please [squash and rebase commits on master](https://blog.carbonfive.com/always-squash-and-rebase-your-git-commits/).

Pull Requests must be labelled before they are merged to master. This is used by [Release Drafter](https://github.com/release-drafter/release-drafter#readme) to automate Release Notes on GitHub.

## Publishing a new npm package

The npm package publishing is handled by a GitHub Workflow using [semantic-release](https://www.npmjs.com/package/semantic-release).

A new package will be released whenever a PR is merged into master.

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
