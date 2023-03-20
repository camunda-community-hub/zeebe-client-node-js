import fs from 'fs'
import path from 'path'
import { OAuthProvider } from '../lib/OAuthProvider'
import http from 'http'
import { StatefulLogInterceptor } from '../lib/StatefulLogInterceptor'

const STORED_ENV = {}
const ENV_VARS_TO_STORE = ['ZEEBE_TOKEN_CACHE_DIR']

beforeAll(() => {
	ENV_VARS_TO_STORE.forEach(e => {
		STORED_ENV[e] = process.env[e]
		delete process.env[e]
	})
})

afterAll(() => {
	ENV_VARS_TO_STORE.forEach(e => {
		delete process.env[e]
		if (STORED_ENV[e]) {
			process.env[e] = STORED_ENV[e]
		}
	})
})

const log = new StatefulLogInterceptor({
	characteristics: {startupTime: 0,
		_tag: 'VANILLA'
	},
	logConfig: {
		_tag: 'ZBCLIENT',
		namespace: '[OAuth test]'
	}

})

test("Creates the token cache dir if it doesn't exist", () => {
	const tokenCache = path.join(__dirname, '.token-cache')
	if (fs.existsSync(tokenCache)) {
		fs.rmdirSync(tokenCache)
	}
	expect(fs.existsSync(tokenCache)).toBe(false)
	const o = new OAuthProvider({
		audience: 'token',
		cacheDir: tokenCache,
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
		log
	})
	expect(o).toBeTruthy()
	expect(fs.existsSync(tokenCache)).toBe(true)
	if (fs.existsSync(tokenCache)) {
		fs.rmdirSync(tokenCache)
	}
	expect(fs.existsSync(tokenCache)).toBe(false)
})

test('Gets the token cache dir from the environment', () => {
	const tokenCache = path.join(__dirname, '.token-cache')
	if (fs.existsSync(tokenCache)) {
		fs.rmdirSync(tokenCache)
	}
	expect(fs.existsSync(tokenCache)).toBe(false)
	process.env.ZEEBE_TOKEN_CACHE_DIR = tokenCache
	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
		log
	})
	expect(o).toBeTruthy()
	expect(fs.existsSync(tokenCache)).toBe(true)
	if (fs.existsSync(tokenCache)) {
		fs.rmdirSync(tokenCache)
	}
	expect(fs.existsSync(tokenCache)).toBe(false)
})

test('Uses an explicit token cache over the environment', () => {
	const tokenCache1 = path.join(__dirname, '.token-cache1')
	const tokenCache2 = path.join(__dirname, '.token-cache2')
	;[tokenCache1, tokenCache2].forEach(tokenCache => {
		if (fs.existsSync(tokenCache)) {
			fs.rmdirSync(tokenCache)
		}
		expect(fs.existsSync(tokenCache)).toBe(false)
	})
	process.env.ZEEBE_TOKEN_CACHE_DIR = tokenCache1
	const o = new OAuthProvider({
		audience: 'token',
		cacheDir: tokenCache2,
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
		log
	})
	expect(o).toBeTruthy()
	expect(fs.existsSync(tokenCache2)).toBe(true)
	expect(fs.existsSync(tokenCache1)).toBe(false)
	;[tokenCache1, tokenCache2].forEach(tokenCache => {
		if (fs.existsSync(tokenCache)) {
			fs.rmdirSync(tokenCache)
		}
		expect(fs.existsSync(tokenCache)).toBe(false)
	})
})

test('Throws in the constructor if the token cache is not writable', () => {
	const tokenCache = path.join(__dirname, '.token-cache')
	if (fs.existsSync(tokenCache)) {
		fs.rmdirSync(tokenCache)
	}
	expect(fs.existsSync(tokenCache)).toBe(false)
	fs.mkdirSync(tokenCache, 0o400)
	expect(fs.existsSync(tokenCache)).toBe(true)
	let thrown = false
	try {
		const o = new OAuthProvider({
			audience: 'token',
			cacheDir: tokenCache,
			cacheOnDisk: true,
			clientId: 'clientId',
			// file deepcode ignore HardcodedNonCryptoSecret/test: <please specify a reason of ignoring this>
			clientSecret: 'clientSecret',
			url: 'url',
			log
		})
		expect(o).toBeTruthy()
	} catch {
		thrown = true
	}
	expect(thrown).toBe(true)
	if (fs.existsSync(tokenCache)) {
		fs.rmdirSync(tokenCache)
	}
	expect(fs.existsSync(tokenCache)).toBe(false)
})

test('Can set a custom user agent', () => {
	process.env.ZEEBE_CLIENT_CUSTOM_AGENT_STRING = 'modeler'
	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
		log
	})
	expect(o.userAgentString.includes(' modeler')).toBe(true)
})

test('Uses form encoding for request', done => {
	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: false,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'http://127.0.0.1:3001',
		log
	})
	const server = http
		.createServer((req, res) => {
			if (req.method === 'POST') {
				let body = ''
				req.on('data', chunk => {
					body += chunk
				})

				req.on('end', () => {
					res.writeHead(200, { 'Content-Type': 'application/json' })
					res.end('{"token": "something"}')
					server.close()
					expect(body).toEqual(
						'audience=token&client_id=clientId&client_secret=clientSecret&grant_type=client_credentials'
					)
					done()
				})
			}
		})
		.listen(3001)
	o.getToken()

	expect(o.userAgentString.includes(' modeler')).toBe(true)
})
