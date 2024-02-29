import fs from 'fs'
import http from 'http'
import path from 'path'
import { OAuthProvider } from '../lib/OAuthProvider'

const STORED_ENV = {}
const ENV_VARS_TO_STORE = ['ZEEBE_TOKEN_CACHE_DIR']

const tokenCache = path.join(__dirname, '.token-cache');

beforeAll(() => {
	ENV_VARS_TO_STORE.forEach(e => {
		STORED_ENV[e] = process.env[e]
		delete process.env[e]
	})
})

afterEach(() => {
	clearCache(tokenCache);
});

afterEach(() => {
	ENV_VARS_TO_STORE.forEach(e => {
		delete process.env[e]
		if (STORED_ENV[e]) {
			process.env[e] = STORED_ENV[e]
		}
	})
})

test("Creates the token cache dir if it doesn't exist", () => {
	const o = new OAuthProvider({
		audience: 'token',
		cacheDir: tokenCache,
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
	})
	expect(o).toBeTruthy()
	expect(fs.existsSync(tokenCache)).toBe(true)
	o.stopExpiryTimer()
})

test('Gets the token cache dir from the environment', () => {
	process.env.ZEEBE_TOKEN_CACHE_DIR = tokenCache
	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
	})
	expect(o).toBeTruthy()
	expect(fs.existsSync(tokenCache)).toBe(true)
	o.stopExpiryTimer()
})

test('Uses an explicit token cache over the environment', () => {
	const tokenCache_other = path.join(__dirname, '.token-cache2')
	process.env.ZEEBE_TOKEN_CACHE_DIR = tokenCache_other
	const o = new OAuthProvider({
		audience: 'token',
		cacheDir: tokenCache,
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'url',
	})
	expect(o).toBeTruthy()
	expect(fs.existsSync(tokenCache)).toBe(true)
	expect(fs.existsSync(tokenCache_other)).toBe(false)
	o.stopExpiryTimer()
})

test('Throws in the constructor if the token cache is not writable', () => {
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
		})
		expect(o).toBeTruthy()
		o.stopExpiryTimer()
	} catch {
		thrown = true
	}
	expect(thrown).toBe(true)
})

test('Send form encoded request', () => {
	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: false,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'http://127.0.0.1:3001/foobar',
	})
	const server = http
		.createServer((req, res) => {
			expect(req.url).toBe('/foobar')
			expect(req.method).toBe('POST')
			expect(req.headers['user-agent']).toContain('zeebe-client-nodejs/')

			let body = ''
			req.on('data', chunk => {
				body += chunk
			})

			req.on('end', () => {
				expect(body).toEqual(
					'audience=token&client_id=clientId&client_secret=clientSecret&grant_type=client_credentials'
				)

				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end('{"token": "something"}')
			})
		})
		.listen(3001)
	return o.getToken().finally(() => {
		o.stopExpiryTimer()
		return server.close()
	})
})

test('Can set a custom user agent', () => {
	process.env.ZEEBE_CLIENT_CUSTOM_AGENT_STRING = 'modeler'
	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: true,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'http://127.0.0.1:3002',
	})
	const server = http
		.createServer((req, res) => {
			expect(req.method).toBe('POST')
			expect(req.headers['user-agent']).toContain('modeler')

			req.on('data', () => {
				// ignoring
			})

			req.on('end', () => {
				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end('{"token": "something"}')
			})
		})
		.listen(3002)

	return o.getToken().finally(() => {
		o.stopExpiryTimer()

		delete process.env.ZEEBE_CLIENT_CUSTOM_AGENT_STRING

		return server.close()
	})
})

test('Passes scope, if provided', () => {
	const o = new OAuthProvider({
		audience: 'token',
		scope: 'scope',
		cacheOnDisk: false,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'http://127.0.0.1:3001',
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

					expect(body).toEqual(
						'audience=token&client_id=clientId&client_secret=clientSecret&grant_type=client_credentials&scope=scope'
					)
				})
			}
		})
		.listen(3001)

	return o.getToken().finally(() => {
		o.stopExpiryTimer()

		return server.close()
	})
})

test('In-memory cache is populated and evicted after timeout', () => {
	const delay = timeout =>
		new Promise(res => setTimeout(() => res(null), timeout))

	const o = new OAuthProvider({
		audience: 'token',
		cacheOnDisk: false,
		clientId: 'clientId',
		clientSecret: 'clientSecret',
		url: 'http://127.0.0.1:3001',
	})
	const server = http
		.createServer((req, res) => {
			expect(req.method).toBe('POST')

			req.on('data', () => {
				// ignoring
			})

			req.on('end', () => {
				res.writeHead(200, { 'Content-Type': 'application/json' })
				let expires_in = 2 // seconds
				res.end(
					'{"access_token": "something", "expires_in": ' +
						expires_in +
						'}'
				)
			})
		})
		.listen(3001)

	return o
		.getToken()
		.then(async () => {
			expect(o.tokenCache['clientId']).toBeDefined()
			await delay(500)
			expect(o.tokenCache['clientId']).toBeDefined()
			await delay(1600)
			expect(o.tokenCache['clientId']).not.toBeDefined()
		})
		.finally(() => {
			o.stopExpiryTimer()

			return server.close()
		})
})


function clearCache(cachePath) {
	if (fs.existsSync(cachePath)) {
		fs.rmSync(cachePath, { recursive: true })
	}
	expect(fs.existsSync(cachePath)).toBe(false)
}
