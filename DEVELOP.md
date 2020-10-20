# Development

## Publishing a new NPM Package

The NPM package publishing is handled by a GitHub Workflows using the [publish-to-npm](https://github.com/marketplace/actions/publish-to-npm) action.

To publish a new package, update the `package.json` package version and push a commit with the commit message "Release x.y.z" matching the package version.
