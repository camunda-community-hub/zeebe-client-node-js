import * as fs from 'fs'
import got from 'got'
import * as os from 'os'
import { clearTimeout } from 'timers'
import uuid = require('uuid')
import pkg = require('../../package.json')
const homedir = os.homedir()
const debug = require('debug')('oauth')
const trace = require('debug')('oauth:trace')

const BACKOFF_TOKEN_ENDPOINT_MAX = 60000 // 60 seconds

interface Token {
	access_token: string
	scope: string
	expires_in: number
	token_type: string
	expiry: number
}

export interface OAuthProviderConfig {
	/** OAuth Endpoint URL */
	url: string
	/** OAuth Audience */
	audience: string
	/** OAuth Scope */
	scope?: string
	clientId: string
	clientSecret: string
	/** Custom TLS certificate for OAuth */
	customRootCert?: Buffer
	/** Cache token in memory and on filesystem? */
	cacheOnDisk?: boolean
	/** Override default token cache directory */
	cacheDir?: string
}

export class OAuthProvider {
	private static readonly defaultTokenCache = `${homedir}/.camunda`
	private static readonly getTokenCacheDirFromEnv = () =>
		process.env.ZEEBE_TOKEN_CACHE_DIR || OAuthProvider.defaultTokenCache
	public cacheDir: string
	public audience: string
	public scope?: string
	public url: string
	public clientId: string
	public clientSecret: string
	public customRootCert?: Buffer
	public useFileCache: boolean
	public tokenCache = {}
	userAgentString: string
	private currentBackoffTime: number = 1
	private inflightTokenRequest?: Promise<string>
	private expiryTimer?: NodeJS.Timeout
	uuid: string

	constructor({
		/** OAuth Endpoint URL */
		url,
		/** OAuth Audience */
		audience,
		/** OAuth Scope */
		scope,
		cacheDir,
		clientId,
		clientSecret,
		/** Custom TLS certificate for OAuth */
		customRootCert,
		/** Cache token in memory and on filesystem? */
		cacheOnDisk,
	}: {
		url: string
		audience: string
		scope?: string
		cacheDir?: string
		clientId: string
		clientSecret: string
		customRootCert?: Buffer
		cacheOnDisk: boolean
	}) {
		this.url = url
		this.audience = audience
		this.scope = scope
		this.clientId = clientId
		this.clientSecret = clientSecret
		this.customRootCert = customRootCert
		this.useFileCache = cacheOnDisk
		this.cacheDir = cacheDir || OAuthProvider.getTokenCacheDirFromEnv()
		this.uuid = uuid.v4()

		const CUSTOM_AGENT_STRING = process.env.ZEEBE_CLIENT_CUSTOM_AGENT_STRING
		this.userAgentString = `zeebe-client-nodejs/${pkg.version}${
			CUSTOM_AGENT_STRING ? ' ' + CUSTOM_AGENT_STRING : ''
		}`

		if (this.useFileCache) {
			try {
				if (!fs.existsSync(this.cacheDir)) {
					fs.mkdirSync(this.cacheDir)
				}
				fs.accessSync(this.cacheDir, fs.constants.W_OK)
			} catch (e: any) {
				throw new Error(
					`FATAL: Cannot write to OAuth cache dir ${cacheDir}\n` +
						'If you are running on AWS Lambda, set the HOME environment variable of your lambda function to /tmp'
				)
			}
		}
	}

	public async getToken(): Promise<string> {
		if (this.tokenCache[this.clientId]) {
			debug(`Using cached token from memory...`)
			return this.tokenCache[this.clientId].access_token
		}
		if (this.useFileCache) {
			const cachedToken = this.fromFileCache(this.clientId)
			if (cachedToken) {
				debug(`Using cached token from file...`)
				return cachedToken.access_token
			}
		}

		if (!this.inflightTokenRequest) {
		 	this.inflightTokenRequest = new Promise((resolve, reject) => {
				setTimeout(
					() => {
						this.debouncedTokenRequest()
							.then(res => {
								this.currentBackoffTime = 1
								this.inflightTokenRequest = undefined
								resolve(res)
							})
							.catch(e => {
								if (this.currentBackoffTime === 1) {
									this.currentBackoffTime = 1000
								}
								this.currentBackoffTime = Math.min(this.currentBackoffTime * 2, BACKOFF_TOKEN_ENDPOINT_MAX)
								this.inflightTokenRequest = undefined
								reject(e)
							})
					},
					this.currentBackoffTime
				)
			})
		}
		return this.inflightTokenRequest
	}

	public stopExpiryTimer() {
		if (this.expiryTimer) {
			clearTimeout(this.expiryTimer)
			trace(`${this.uuid} stop`)
		}
	}

	private debouncedTokenRequest() {
		const form = {
			audience: this.audience,
			client_id: this.clientId,
			client_secret: this.clientSecret,
			grant_type: 'client_credentials',
			...(
				this.scope && { scope: this.scope } || {}
			)
		}

		debug(`Requesting token from token endpoint...`)
		return got
			.post(this.url, {
				form,
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'user-agent': this.userAgentString,
				},
				https: {
					certificateAuthority: this.customRootCert
				}
			})
			.then(res => {
				return this.safeJSONParse(res.body).then(token => {
					debug(`Received token from token endpoint.`)

					const d = new Date()
					token.expiry = d.setSeconds(d.getSeconds()) + (token.expires_in * 1000)
					if (this.useFileCache) {
						this.toFileCache(token)
					}
					this.tokenCache[this.clientId] = token
					this.startExpiryTimer(token)
					return token.access_token
				})
			})
	}

	private safeJSONParse(thing: any): Promise<Token> {
		return new Promise((resolve, reject) => {
			try {
				resolve(JSON.parse(thing))
			} catch (e: any) {
				reject(e)
			}
		})
	}

	private fromFileCache(clientId: string) {
		let token: Token
		const tokenCachedInFile = fs.existsSync(this.cachedTokenFile(clientId))
		debug(`Checking token cache file...`)
		if (!tokenCachedInFile) {
			debug(`No token cache file found...`)
			return null
		}
		try {
			debug(`Using token cache file ${this.cachedTokenFile(clientId)}`)
			token = JSON.parse(
				fs.readFileSync(this.cachedTokenFile(clientId), 'utf8')
			)

			if (this.isExpired(token)) {
				debug(`Cached token is expired...`)
				return null
			}
			this.tokenCache[this.clientId] = token
			this.startExpiryTimer(token)
			return token
		} catch (e:any) {
			debug(`Failed to load cached token: ${e.message}`)
			return null
		}
	}

	private toFileCache(token: Token) {
		const file = this.cachedTokenFile(this.clientId)

		fs.writeFile(
			file,
			JSON.stringify(token),
			e => {
				if (!e) {
					return
				}
				// tslint:disable-next-line
				console.error('Error writing OAuth token to file' + file)
				// tslint:disable-next-line
				console.error(e)
			}
		)
	}

	private isExpired(token: Token) {
		const d = new Date()
		return token.expiry <= d.setSeconds(d.getSeconds())
	}

	private startExpiryTimer(token: Token) {
		const d = new Date()
		const current = d.setSeconds(d.getSeconds())
		const validityPeriod = token.expiry - current
		if (validityPeriod <= 0) {
			delete this.tokenCache[this.clientId]
			return
		}
		// renew token 1s before it expires to avoid race conditions on the wire
		// evict disk cache at same time as in-memory cache
		// See: https://github.com/camunda-community-hub/zeebe-client-node-js/issues/336
		const minimumCacheLifetime = 0; // Minimum cache lifetime in milliseconds
		const renewTokenAfterMs = Math.max(validityPeriod - 1000, minimumCacheLifetime)
		this.expiryTimer = setTimeout(() => {
			trace(`${this.uuid} token expired`)
			delete this.tokenCache[this.clientId]
			if (this.useFileCache && fs.existsSync(this.cachedTokenFile(this.clientId))) {
				fs.unlinkSync(this.cachedTokenFile(this.clientId))
			}
		}, renewTokenAfterMs)
		trace(`${this.uuid} token expiry timer start: ${renewTokenAfterMs}ms`)
	}

	private cachedTokenFile = (clientId: string) =>
		`${this.cacheDir}/oauth-token-${clientId}.json`
}
