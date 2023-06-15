module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	testPathIgnorePatterns: ['node_modules', 'dist'],
	collectCoverageFrom: ['!src/__tests__/lib/cancelProcesses.ts']
}
