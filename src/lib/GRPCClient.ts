// import { Client, credentials, loadPackageDefinition } from '@grpc/grpc-js'
import { loadSync, Options, PackageDefinition } from '@grpc/proto-loader'
import chalk from 'chalk'
import { EventEmitter } from 'events'
import { Client, credentials, loadPackageDefinition, Metadata } from 'grpc'
import { Loglevel } from './interfaces'
import { OAuthProvider } from './OAuthProvider'
import { ZBLogger } from './ZBLogger'

interface GRPCClientExtendedOptions {
	longPoll?: number
}

// @TODO: Better handling of status codes to deal with TLS and OAuth
// https://github.com/grpc/grpc/blob/master/doc/statuscodes.md

const GrpcState = {
	/**
	 * The channel is trying to establish a connection and is waiting to make progress on one of the steps involved in name resolution,
	 * TCP connection establishment or TLS handshake.
	 */
	CONNECTING: 1 as 1,
	/**
	 * This is the state where the channel is not even trying to create a connection because of a lack of new or pending RPCs.
	 */
	IDLE: 0 as 0,
	/**
	 * The channel has successfully established a connection all the way through TLS handshake (or equivalent)
	 * and all subsequent attempt to communicate have succeeded (or are pending without any known failure ).
	 */
	READY: 2 as 2,
	/**
	 * This channel has started shutting down.
	 */
	SHUTDOWN: 4 as 4,
	/**
	 * There has been some transient failure (such as a TCP 3-way handshake timing out or a socket error).
	 */
	TRANSIENT_FAILURE: 3 as 3,
}
const connectivityState = [
	'IDLE',
	'CONNECTING',
	'READY',
	'TRANSIENT_FAILURE',
	'SHUTDOWN',
]

export class GRPCClient extends EventEmitter {
	public channelClosed = false
	public longPoll?: number
	public connected: boolean = false
	public client: Client
	public onReady?: () => void
	private packageDefinition: PackageDefinition
	private listNameMethods: string[]
	private logger: ZBLogger
	private gRPCRetryCount = 0
	private oAuth?: OAuthProvider
	private readyTimer?: NodeJS.Timeout
	private failTimer?: NodeJS.Timeout
	private connectionTolerance: number
	private onConnectionError?: () => void

	constructor({
		host,
		loglevel,
		oAuth,
		options = {},
		packageName,
		protoPath,
		service,
		useTLS,
		stdout = console,
		onConnectionError,
		onReady,
	}: {
		host: string
		loglevel: Loglevel
		oAuth?: OAuthProvider
		options: Options & GRPCClientExtendedOptions
		packageName: string
		protoPath: string
		service: string
		useTLS: boolean
		stdout: any
		onConnectionError?: () => void
		onReady?: () => void
	}) {
		super()
		this.oAuth = oAuth
		this.longPoll = options.longPoll
		this.connectionTolerance = 3000 // @TODO - make configurable

		this.onReady = onReady
		this.onConnectionError = onConnectionError
		this.on('ready', () => this.setReady())
		this.on('error', () => this.setNotReady())

		this.logger = new ZBLogger({
			color: chalk.green,
			id: 'gRPC Channel',
			loglevel,
			namespace: 'ZBWorker',
			pollMode: this.longPoll ? 'Long Poll' : 'Fast Poll',
			stdout,
			taskType: 'gRPC Channel',
		})
		this.packageDefinition = loadSync(protoPath, {
			defaults: options.defaults === undefined ? true : options.defaults,
			enums: options.enums === undefined ? String : options.enums,
			keepCase: options.keepCase === undefined ? true : options.keepCase,
			longs: options.longs === undefined ? String : options.longs,
			oneofs: options.oneofs === undefined ? true : options.oneofs,
		})

		const proto = loadPackageDefinition(this.packageDefinition)[packageName]
		const listMethods = this.packageDefinition[`${packageName}.${service}`]
		const channelCredentials = useTLS
			? credentials.createSsl()
			: credentials.createInsecure()
		this.client = new proto[service](host, channelCredentials, {
			'grpc.enable_retries': 1,
			'grpc.initial_reconnect_backoff_ms': 1000,
			'grpc.max_reconnect_backoff_ms': 50000,
			'grpc.min_reconnect_backoff_ms': 1000,
		})
		this.listNameMethods = []

		for (const key in listMethods) {
			if (listMethods[key]) {
				const methodName = listMethods[key].originalName as string

				this.listNameMethods.push(methodName)

				this[`${methodName}Async`] = async (data, fnAnswer) => {
					const metadata = await this.getJWT()
					this.client[methodName](data, metadata, fnAnswer)
				}

				this[`${methodName}Stream`] = async data => {
					let stream
					// if (this.longPoll) {
					// This is a client-side deadline timeout
					// Let the server manage the deadline.
					// See: https://github.com/zeebe-io/zeebe/issues/2987
					// const deadline = new Date().setSeconds(
					// 	new Date().getSeconds() + this.longPoll / 1000
					// )
					// return this.client[methodName](data, { deadline })
					// } else {
					try {
						const metadata = await this.getJWT()
						stream = this.client[methodName](data, metadata)
					} catch (e) {
						this.logger.error(e)
					}
					/**
					 * Once this gets attached here, it is attached to *all* calls
					 * This is an issue if you do a sync call like cancelWorkflowSync
					 * The error will not propagate, and the channel will be closed.
					 * So we use a separate GRPCClient for the client, which never does
					 * streaming calls, and each worker, which only does streaming calls
					 */
					stream.on('error', (error: any) =>
						this.handleGrpcError(stream)(error)
					)
					stream.on('data', () => (this.gRPCRetryCount = 0))
					return stream
				}

				this[`${methodName}Sync`] = data => {
					const client = this.client
					return new Promise(async (resolve, reject) => {
						try {
							const metadata = await this.getJWT()
							client[methodName](data, metadata, (err, dat) => {
								if (err) {
									this.setNotReady()
									return reject(err)
								}
								this.setReady()
								resolve(dat)
							})
						} catch (e) {
							reject(e)
						}
					})
				}
			}
		}
	}

	public runService(fnName, data, fnAnswer) {
		this.client[fnName](data, fnAnswer)
	}

	public listMethods() {
		return this.listNameMethods
	}

	public close() {
		this.client.close()
		this.channelClosed = true
	}

	private async getJWT() {
		let metadata
		if (this.oAuth) {
			const token = await this.oAuth.getToken()
			metadata = new Metadata()
			metadata.add('Authorization', `Bearer ${token}`)
		}
		return metadata
	}

	private watchGrpcChannel(): Promise<number> {
		return new Promise(resolve => {
			const gRPC = this.client
			if (this.channelClosed) {
				return
			}
			const state = gRPC.getChannel().getConnectivityState(false)
			this.logger.error(`GRPC Channel State: ${connectivityState[state]}`)
			const deadline = new Date().setSeconds(
				new Date().getSeconds() + 300
			)
			if (state === GrpcState.IDLE) {
				return resolve(state)
			}
			gRPC.getChannel().watchConnectivityState(
				state,
				deadline,
				async error => {
					if (this.channelClosed) {
						return
					}
					this.gRPCRetryCount++
					if (error) {
						this.logger.error({ error })
					}
					const newState = gRPC
						.getChannel()
						.getConnectivityState(false)
					this.logger.log(
						`gRPC Channel State: ${connectivityState[newState]}`
					)
					this.logger.info(`gRPC Retry count: ${this.gRPCRetryCount}`)
					if (
						newState === GrpcState.READY ||
						newState === GrpcState.IDLE
					) {
						this.logger.info('gRPC reconnected')
						return resolve(newState)
					} else {
						return resolve(await this.watchGrpcChannel())
					}
				}
			)
		})
	}

	private setReady() {
		// debounce rapid connect / disconnect
		if (this.readyTimer) {
			clearTimeout(this.readyTimer)
		}
		this.readyTimer = setTimeout(() => {
			this.readyTimer = undefined
			this.connected = true
			if (this.onReady) {
				this.onReady()
			}
			if (this.failTimer) {
				clearTimeout(this.failTimer)
				this.failTimer = undefined
			}
		}, this.connectionTolerance)
	}

	private setNotReady() {
		// tslint:disable-next-line: no-console
		console.log('setNotReady called') // @DEBUG
		if (this.readyTimer) {
			clearTimeout(this.readyTimer)
			this.readyTimer = undefined
		}
		this.connected = false
		if (!this.failTimer) {
			this.failTimer = setTimeout(() => {
				if (this.onConnectionError) {
					this.onConnectionError()
				}
			}, this.connectionTolerance)
		}
	}

	private handleGrpcError = (stream: any) => async (err: any) => {
		this.emit('error', err)
		this.logger.error(`GRPC ERROR: ${err.message}`)
		const channelState = await this.watchGrpcChannel()
		this.logger.debug(
			`gRPC Channel state: ${connectivityState[channelState]}`
		)
		stream.removeAllListeners()
		if (
			channelState === GrpcState.READY ||
			channelState === GrpcState.IDLE
		) {
			this.logger.info('gRPC Channel reconnected')
			this.emit('ready')
		}
	}
}
