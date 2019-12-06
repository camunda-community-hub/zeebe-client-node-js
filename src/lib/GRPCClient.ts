// import { Client, credentials, loadPackageDefinition } from '@grpc/grpc-js'
import { loadSync, Options, PackageDefinition } from '@grpc/proto-loader'
import chalk from 'chalk'
import { EventEmitter } from 'events'
import { Client, credentials, loadPackageDefinition, Metadata } from 'grpc'
import { BasicAuthConfig, Loglevel } from './interfaces'
import { OAuthProvider } from './OAuthProvider'
import { ZBLogger } from './ZBLogger'

interface GRPCClientExtendedOptions {
	longPoll?: number
}
// tslint:disable: object-literal-sort-keys

const GrpcError = {
	OK: 0 as 0,
	CANCELLED: 1 as 1,
	UNKNOWN: 2 as 2,
	INVALID_ARGUMENT: 3 as 3,
	DEADLINE_EXCEEDED: 4 as 4,
	NOT_FOUND: 5 as 5,
	ALREADY_EXISTS: 6 as 6,
	PERMISSION_DENIED: 7 as 7,
	UNAUTHENTICATED: 16 as 16,
	RESOURCE_EXHAUSTED: 8 as 8,
	FAILED_PRECONDITION: 9 as 9,
	ABORTED: 10 as 10,
	OUT_OF_RANGE: 11 as 11,
	UNIMPLEMENTED: 12 as 12,
	INTERNAL: 13 as 13,
	UNAVAILABLE: 14 as 14,
	DATA_LOSS: 15 as 15,
}

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
	private basicAuth?: BasicAuthConfig

	constructor({
		basicAuth,
		connectionTolerance,
		host,
		loglevel,
		oAuth,
		options = {},
		packageName,
		protoPath,
		service,
		namespace,
		tasktype,
		useTLS,
		stdout = console,
		onConnectionError,
		onReady,
	}: {
		basicAuth?: BasicAuthConfig
		connectionTolerance: number
		host: string
		loglevel: Loglevel
		oAuth?: OAuthProvider
		options: Options & GRPCClientExtendedOptions
		packageName: string
		protoPath: string
		service: string
		namespace: string
		tasktype?: string
		useTLS: boolean
		stdout: any
		onConnectionError?: () => void
		onReady?: () => void
	}) {
		super()
		this.oAuth = oAuth
		this.basicAuth = basicAuth
		this.longPoll = options.longPoll
		this.connectionTolerance = connectionTolerance

		this.onReady = onReady
		this.onConnectionError = onConnectionError
		this.on('ready', () => this.setReady())
		this.on('error', () => this.setNotReady())

		this.logger = new ZBLogger({
			color: chalk.green,
			id: 'gRPC Channel',
			loglevel,
			namespace,
			pollInterval: this.longPoll!,
			stdout,
			taskType: tasktype,
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
		// Options documented here: https://github.com/grpc/grpc/blob/master/include/grpc/impl/codegen/grpc_types.h
		this.client = new proto[service](host, channelCredentials, {
			/**
			 * If set to zero, disables retry behavior.
			 * Otherwise, transparent retries are enabled for all RPCs,
			 * and configurable retries are enabled when they are configured
			 * via the service config. For details, see:
			 * https://github.com/grpc/proposal/blob/master/A6-client-retries.md
			 */
			'grpc.enable_retries': 1,
			/**
			 * The time between the first and second connection attempts,
			 * in ms
			 */
			'grpc.initial_reconnect_backoff_ms': 1000,
			/**
			 * The maximum time between subsequent connection attempts,
			 * in ms
			 */
			'grpc.max_reconnect_backoff_ms': 30000,
			/**
			 * The minimum time between subsequent connection attempts,
			 * in ms
			 */
			'grpc.min_reconnect_backoff_ms': 1000,
			/**
			 * After a duration of this time the client/server
			 * pings its peer to see if the transport is still alive.
			 * Int valued, milliseconds.
			 */
			'grpc.keepalive_time_ms': 30000,
			/**
			 * After waiting for a duration of this time,
			 * if the keepalive ping sender does
			 * not receive the ping ack, it will close the
			 * transport. Int valued, milliseconds.
			 */
			'grpc.keepalive_timeout_ms': 20000,
			'grpc.http2.min_time_between_pings_ms': 15000,
			/**
			 * Minimum allowed time between a server receiving
			 * successive ping frames without sending any data
			 * frame. Int valued, milliseconds
			 */
			'grpc.http2.min_ping_interval_without_data_ms': 20000,
			/**
			 * This channel argument if set to 1
			 * (0 : false; 1 : true), allows keepalive pings
			 * to be sent even if there are no calls in flight.
			 */
			'grpc.keepalive_permit_without_calls': 1,
			/**
			 * This channel argument controls the maximum number
			 * of pings that can be sent when there is no other
			 * data (data frame or header frame) to be sent.
			 * GRPC Core will not continue sending pings if we
			 * run over the limit. Setting it to 0 allows sending
			 * pings without sending data.
			 */
			'grpc.http2.max_pings_without_data': 0,
		})
		this.listNameMethods = []

		for (const key in listMethods) {
			if (listMethods[key]) {
				const methodName = listMethods[key].originalName as string

				this.listNameMethods.push(methodName)

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
						const metadata = await this.getAuthToken()
						stream = this.client[methodName](data, metadata)
						this.setReady()
					} catch (e) {
						this.logger.error(e)
						this.setNotReady()
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
							const metadata = await this.getAuthToken()
							client[methodName](data, metadata, (err, dat) => {
								// This will error on network or business errors
								if (err) {
									const code = err.code
									const isNetworkError =
										code === GrpcError.UNAVAILABLE
									if (isNetworkError) {
										this.setNotReady()
									} else {
										this.setReady()
									}
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

	public close(timeout = 5000) {
		return new Promise((resolve, reject) => {
			let alreadyClosed = false
			const gRPC = this.client
			let state: any
			try {
				state = gRPC.getChannel().getConnectivityState(false)
			} catch (e) {
				const msg = e.toString()
				alreadyClosed = msg.includes(
					'Cannot call getConnectivityState on a closed Channel'
				)
				if (alreadyClosed) {
					setTimeout(() => resolve(), 2000)
				}
			}
			if (!alreadyClosed) {
				this.logger.info(
					`GRPC Channel State: ${connectivityState[state]}`
				)
				const deadline = new Date().setSeconds(
					new Date().getSeconds() + 300
				)
				gRPC.getChannel().watchConnectivityState(
					state,
					deadline,
					async () => {
						try {
							const newState = gRPC
								.getChannel()
								.getConnectivityState(false)
							this.logger.info(
								`GRPC Channel State: ${connectivityState[newState]}`
							)
						} catch (e) {
							const msg = e.toString()
							alreadyClosed = msg.includes(
								'Cannot call getConnectivityState on a closed Channel'
							)
							this.logger.info(`Closed: ${alreadyClosed}`)
							if (alreadyClosed) {
								setTimeout(() => resolve(), 2000)
							}
						}
					}
				)
			}
			this.client.close()
			this.channelClosed = true
			setTimeout(() => (alreadyClosed ? null : reject()), timeout)
		})
	}

	private async getAuthToken() {
		let metadata
		if (this.oAuth) {
			const token = await this.oAuth.getToken()
			metadata = new Metadata()
			metadata.add('Authorization', `Bearer ${token}`)
		}
		if (this.basicAuth) {
			const token = Buffer.from(
				`${this.basicAuth.username}:${this.basicAuth.password}`
			).toString('base64')
			metadata = new Metadata()
			metadata.add('Authorization', `Basic ${token}`)
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
			if (state === GrpcState.IDLE || state === GrpcState.READY) {
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
