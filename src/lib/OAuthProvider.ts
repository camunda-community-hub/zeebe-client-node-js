import * as fs from 'fs'
import got from 'got'
import * as os from 'os'
import pkg = require('../../package.json')
import { StatefulLogInterceptor } from './StatefulLogInterceptor'
const homedir = os.homedir()

const BACKOFF_TOKEN_ENDPOINT_FAILURE = 1000

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
	public url: string
	public clientId: string
	public clientSecret: string
	public customRootCert?: Buffer
	public useFileCache: boolean
	public tokenCache = {}
	private failed = false
	userAgentString: string
	private log: StatefulLogInterceptor

	constructor({
		/** OAuth Endpoint URL */
		url,
		/** OAuth Audience */
		audience,
		cacheDir,
		clientId,
		clientSecret,
		/** Custom TLS certificate for OAuth */
		customRootCert,
		/** Cache token in memory and on filesystem? */
		cacheOnDisk,
		log
	}: {
		url: string
		audience: string
		cacheDir?: string
		clientId: string
		clientSecret: string
		customRootCert?: Buffer
		cacheOnDisk: boolean
		log: StatefulLogInterceptor
	}) {
		this.url = url
		this.audience = audience
		this.clientId = clientId
		this.clientSecret = clientSecret
		this.customRootCert = customRootCert
		this.useFileCache = cacheOnDisk
		this.cacheDir = cacheDir || OAuthProvider.getTokenCacheDirFromEnv()
		this.log = log

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
			this.log.logDebug(`[OAuth] Using cached token from memory...`)
			return this.tokenCache[this.clientId].access_token
		}
		if (this.useFileCache) {
			const cachedToken = this.fromFileCache(this.clientId)
			if (cachedToken) {
				this.log.logDebug(`[OAuth] Using cached token from file...`)
				return cachedToken.access_token
			}
		}

		return new Promise((resolve, reject) => {
			setTimeout(
				() => {
					this.debouncedTokenRequest()
						.then(res => {
							this.failed = false
							resolve(res)
						})
						.catch(e => {
							this.failed = true
							reject(e)
						})
				},
				this.failed ? BACKOFF_TOKEN_ENDPOINT_FAILURE : 1
			)
		})
	}

	private debouncedTokenRequest() {
		const form = {
			audience: this.audience,
			client_id: this.clientId,
			client_secret: this.clientSecret,
			grant_type: 'client_credentials',
		}

		this.log.logDebug(`[OAuth] Requesting token from token endpoint...`)
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
		this.log.logDebug(`[OAuth] Checking token cache file...`)
		if (!tokenCachedInFile) {
			this.log.logDebug(`[OAuth] No token cache file found...`)
			return null
		}
		try {
			token = JSON.parse(
				fs.readFileSync(this.cachedTokenFile(clientId), 'utf8')
			)

			if (this.isExpired(token)) {
				this.log.logDebug(`[OAuth] Cached token is expired...`)
				return null
			}
			this.startExpiryTimer(token)
			return token
		} catch (e:any) {
			this.log.logDebug(`[OAuth] ${e.message}`)
			return null
		}
	}

	private toFileCache(token: Token) {
		const d = new Date()
		const file = this.cachedTokenFile(this.clientId)

		fs.writeFile(
			file,
			JSON.stringify({
				...token,
				expiry: d.setSeconds(d.getSeconds() + token.expires_in),
			}),
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
		const validityPeriod = token.expiry - current * 1000
		if (validityPeriod <= 0) {
			delete this.tokenCache[this.clientId]
			return
		}
		setTimeout(() => delete this.tokenCache[this.clientId], validityPeriod)
	}

	private cachedTokenFile = (clientId: string) =>
		`${this.cacheDir}/oauth-token-${clientId}.json`
}
