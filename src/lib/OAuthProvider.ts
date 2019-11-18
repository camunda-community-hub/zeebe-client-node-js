import * as fs from 'fs'
import * as got from 'got'

import os = require('os')
const homedir = os.homedir()

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
	/** Cache token in memory and on filesystem? */
	cacheOnDisk: boolean
}

export class OAuthProvider {
	private static readonly cacheDir = `${homedir}/.camunda`
	private static cachedTokenFile = (clientId: string) =>
		`${OAuthProvider.cacheDir}/oauth-token-${clientId}.json`
	public audience: string
	public url: string
	public clientId: string
	public clientSecret: string
	public useFileCache: boolean
	public tokenCache = {}

	constructor({
		/** OAuth Endpoint URL */
		url,
		/** OAuth Audience */
		audience,
		clientId,
		clientSecret,
		/** Cache token in memory and on filesystem? */
		cacheOnDisk,
	}: {
		url: string
		audience: string
		clientId: string
		clientSecret: string
		cacheOnDisk: boolean
	}) {
		this.url = url
		this.audience = audience
		this.clientId = clientId
		this.clientSecret = clientSecret
		this.useFileCache = cacheOnDisk

		if (this.useFileCache) {
			try {
				fs.accessSync(OAuthProvider.cacheDir, fs.constants.W_OK)
			} catch (e) {
				throw new Error(
					`FATAL: Cannot write to OAuth cache dir ${OAuthProvider.cacheDir}\n` +
						'If you are running on AWS Lambda, set the HOME environment variable of your lambda function to /tmp'
				)
			}
		}
	}

	public async getToken(): Promise<string> {
		if (this.tokenCache[this.clientId]) {
			return this.tokenCache[this.clientId].access_token
		}
		if (this.useFileCache) {
			const cachedToken = this.fromFileCache(this.clientId)
			if (cachedToken) {
				return cachedToken.access_token
			}
		}
		try {
			const body = JSON.stringify({
				audience: this.audience,
				client_id: this.clientId,
				client_secret: this.clientSecret,
				grant_type: 'client_credentials',
			})
			const res = await got.post(this.url, {
				body,
				headers: {
					'content-type': 'application/json',
				},
			})
			//   console.log(res.body);
			const token = JSON.parse(res.body)
			if (this.useFileCache) {
				this.toFileCache(token)
			}
			this.tokenCache[this.clientId] = token
			this.startExpiryTimer(token)

			return token.access_token
		} catch (e) {
			throw new Error(e)
		}
	}

	private fromFileCache(clientId: string) {
		let token: Token
		const tokenCachedInFile = fs.existsSync(
			OAuthProvider.cachedTokenFile(clientId)
		)
		if (!tokenCachedInFile) {
			return null
		}
		try {
			token = JSON.parse(
				fs.readFileSync(OAuthProvider.cachedTokenFile(clientId), 'utf8')
			)

			if (this.isExpired(token)) {
				return null
			}
			this.startExpiryTimer(token)
			return token
		} catch (_) {
			return null
		}
	}

	private toFileCache(token: Token) {
		const d = new Date()
		const file = OAuthProvider.cachedTokenFile(this.clientId)
		if (!fs.existsSync(OAuthProvider.cacheDir)) {
			fs.mkdirSync(OAuthProvider.cacheDir)
		}
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
				console.log('Error writing OAuth token to file' + file)
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
}
