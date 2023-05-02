import {
	credentials,
	InterceptingCall,
	loadPackageDefinition,
	Metadata,
	status,
	Client,
} from '@grpc/grpc-js'
import { VerifyOptions } from '@grpc/grpc-js/build/src/channel-credentials'
import { loadSync, Options, PackageDefinition } from '@grpc/proto-loader'
import { EventEmitter } from 'events'

import { Duration, MaybeTimeDuration } from 'typed-duration'
import pkg = require('../../package.json')
import { GrpcError } from './GrpcError'
import { BasicAuthConfig } from './interfaces-1.0'
import { Loglevel } from './interfaces-published-contract'
import { OAuthProvider } from './OAuthProvider'

const debug = require('debug')('grpc')

export interface GrpcClientExtendedOptions {
	longPoll?: MaybeTimeDuration
	pollInterval?: MaybeTimeDuration
}
// tslint:disable: object-literal-sort-keys

function replaceTimeValuesWithMillisecondNumber(data: any) {
	if (typeof data !== 'object') {
		return data
	}
	return Object.entries(data).reduce(
		(acc, [key, value]) => ({
			...acc,
			[key]: Duration.isTypedDuration(value)
				? Duration.milliseconds.from(value)
				: value,
		}),
		{}
	)
}

export const MiddlewareSignals = {
	Log: {
		Error: 'MIDDLEWARE_ERROR',
		Info: 'MIDDLEWARE_INFO',
		Debug: 'MIDDLEWARE_DEBUG',
	},
	Event: {
		Error: 'MIDDLEWARE_EVENT_ERROR',
		Ready: 'MIDDLEWARE_EVENT_READY',
		GrpcInterceptError: 'MIDDLEWARE_GRPC_INTERCEPT_ERROR',
	},
}

const InternalSignals = {
	Error: 'INTERNAL_ERROR',
	Ready: 'INTERNAL_READY',
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

export interface GrpcClientCtor {
	basicAuth?: BasicAuthConfig
	connectionTolerance: MaybeTimeDuration
	host: string
	loglevel: Loglevel
	oAuth?: OAuthProvider
	options: Options & GrpcClientExtendedOptions
	packageName: string
	protoPath: string
	service: string
	namespace: string
	tasktype?: string
	useTLS: boolean
	stdout: any
	customSSL?: CustomSSL
}

export interface CustomSSL {
	rootCerts?: Buffer
	privateKey?: Buffer
	certChain?: Buffer
	verifyOptions?: VerifyOptions
}

interface GrpcStreamError {
	code: number
	details: string
	metadata: { internalRepr: any; options: any }
	message: string
}

export class GrpcClient extends EventEmitter {
	public channelClosed = false
	public longPoll?: MaybeTimeDuration
	public connected: boolean = false
	public client: Client
	public host: string
	private closing = false
	private channelState: number = 0
	private packageDefinition: PackageDefinition
	private listNameMethods: string[]
	private gRPCRetryCount = 0
	private oAuth?: OAuthProvider
	private readyTimer?: NodeJS.Timeout
	private failTimer?: NodeJS.Timeout
	private connectionTolerance: number
	private basicAuth?: BasicAuthConfig

	constructor({
		basicAuth,
		connectionTolerance,
		host,
		oAuth,
		options = {},
		packageName,
		protoPath,
		service,
		useTLS,
		customSSL,
	}: GrpcClientCtor) {
		super()
		debug(`Constructing gRPC client...`)
		this.host = host
		this.oAuth = oAuth
		this.basicAuth = basicAuth
		this.longPoll = options.longPoll
		this.connectionTolerance = Duration.milliseconds.from(
			connectionTolerance
		)
		this.emit(
			MiddlewareSignals.Log.Debug,
			`Connection Tolerance: ${Duration.milliseconds.from(
				connectionTolerance
			)}ms`
		)

		this.on(InternalSignals.Ready, () => this.setReady())
		this.on(InternalSignals.Error, () => this.setNotReady())

		this.packageDefinition = loadSync(protoPath, {
			defaults: options.defaults ?? true,
			enums: options.enums ?? String,
			keepCase: options.keepCase ?? true,
			longs: options.longs ?? String,
			oneofs: options.oneofs ?? true,
		})

		const proto = loadPackageDefinition(this.packageDefinition)[packageName]

		const listMethods = this.packageDefinition[`${packageName}.${service}`]
		const channelCredentials = useTLS
			? credentials.createSsl(
					customSSL?.rootCerts,
					customSSL?.privateKey,
					customSSL?.certChain,
					customSSL?.verifyOptions
			  )
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
			'grpc.max_reconnect_backoff_ms': 10000,
			/**
			 * The minimum time between subsequent connection attempts,
			 * in ms. Default is 1000ms, but this can cause an SSL Handshake failure.
			 * This causes an intermittent failure in the Worker-LongPoll test when run
			 * against Camunda Cloud.
			 * Raised to 5000ms.
			 * See: https://github.com/grpc/grpc/issues/8382#issuecomment-259482949
			 */
			'grpc.min_reconnect_backoff_ms': 5000,
			/**
			 * After a duration of this time the client/server
			 * pings its peer to see if the transport is still alive.
			 * Int valued, milliseconds.
			 */
			'grpc.keepalive_time_ms':
				process.env.GRPC_KEEPALIVE_TIME_MS ?? 180000,
			/**
			 * After waiting for a duration of this time,
			 * if the keepalive ping sender does
			 * not receive the ping ack, it will close the
			 * transport. Int valued, milliseconds.
			 */
			'grpc.keepalive_timeout_ms': 120000,
			'grpc.http2.min_time_between_pings_ms': 90000,
			/**
			 * Minimum allowed time between a server receiving
			 * successive ping frames without sending any data
			 * frame. Int valued, milliseconds
			 */
			'grpc.http2.min_ping_interval_without_data_ms': 90000,
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
			interceptors: [this.interceptor],
		})
		this.listNameMethods = []

		this.client.waitForReady(10000, error =>
			error
				? this.emit(MiddlewareSignals.Event.Error, error)
				: this.emit(MiddlewareSignals.Event.Ready)
		)

		for (const key in listMethods) {
			if (listMethods[key]) {
				const methodName = listMethods[key].originalName as string

				this.listNameMethods.push(methodName)

				this[`${methodName}Stream`] = async data => {
					debug(`Calling ${methodName}Stream...`)
					if (this.closing) {
						// tslint:disable-next-line: no-console
						console.log('Short-circuited on channel closed') // @DEBUG
						return
					}
					let stream
					const timeNormalisedRequest = replaceTimeValuesWithMillisecondNumber(
						data
					)
					try {
						const metadata = await this.getAuthToken()

						stream = this.client[methodName](
							timeNormalisedRequest,
							metadata
						)
						this.setReady()
					} catch (error: any) {
						debug(`${methodName}Stream error: ${error.code}`, error.message)
						this.emit(MiddlewareSignals.Log.Error, error.message)
						this.emit(MiddlewareSignals.Event.Error)
						this.setNotReady()
						return { error }
					}
					if (!stream) {
						return {
							error: new Error(
								`No stream returned by call to ${methodName}Stream`
							),
						}
					}

					// This deals with the case where during a broker restart the call returns a stream
					// but that stream is not a legit Gateway activation. In that case, the Gateway will
					// never time out or close the stream. So we have to manage that case.
					const clientsideTimeoutDuration =
						Duration.milliseconds.from(this.longPoll!) + 1000
					const clientSideTimeout = setTimeout(() => {
						debug(
							`Triggered client-side timeout after ${clientsideTimeoutDuration}ms`
						)
						stream.emit('end')
					}, clientsideTimeoutDuration)

					/**
					 * Once this gets attached here, it is attached to *all* calls
					 * This is an issue if you do a sync call like cancelWorkflowSync
					 * The error will not propagate, and the channel will be closed.
					 * So we use a separate GRPCClient for the client, which never does
					 * streaming calls, and each worker, which only does streaming calls
					 */
					stream.on('error', (error: GrpcStreamError) => {
						clearTimeout(clientSideTimeout)
						debug(`${methodName}Stream error emitted by stream`, error)
						this.emit(MiddlewareSignals.Event.Error)
						if (error.message.includes('14 UNAVAILABLE')) {
							this.emit(
								MiddlewareSignals.Log.Error,
								`Grpc Stream Error: ${error.message} - ${host}`
							)
						} else {
							this.emit(
								MiddlewareSignals.Log.Error,
								`Grpc Stream Error: ${error.message}`
							)
						}
						// Do not handle stream errors the same way
						// this.handleGrpcError(stream)(error)
						this.setNotReady()
					})
					stream.on('data', () => (this.gRPCRetryCount = 0))
					stream.on('metadata', md =>
						this.emit(
							MiddlewareSignals.Log.Debug,
							JSON.stringify(md)
						)
					)
					stream.on('status', s =>
						this.emit(
							MiddlewareSignals.Log.Debug,
							`gRPC Status event: ${JSON.stringify(s)}`
						)
					)
					stream.on('end', () => clearTimeout(clientSideTimeout))

					return stream
				}

				this[`${methodName}Sync`] = data => {
					debug(`Calling ${methodName}Sync...`)

					if (this.closing) {
						debug(`Aborting ${methodName}Sync due to client closing.`)
						return
					}
					const timeNormalisedRequest = replaceTimeValuesWithMillisecondNumber(
						data
					)
					const client = this.client
					return new Promise(async (resolve, reject) => {
						try {
							const metadata = (await this.getAuthToken()) || {}
							client[methodName](
								timeNormalisedRequest,
								metadata,
								(err, dat) => {
									// This will error on network or business errors
									if (err) {
										debug(`${methodName}Sync error: ${err.code}`)
										const isNetworkError =
											err.code === GrpcError.UNAVAILABLE
										if (isNetworkError) {
											this.setNotReady()
										} else {
											this.setReady()
										}
										return reject(err)
									}
									this.emit(MiddlewareSignals.Event.Ready)
									this.setReady()
									debug(`${methodName}Sync completed`)
									resolve(dat)
								}
							)
						} catch (e: any) {
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

	public close(timeout = 5000): Promise<null> {
		const STATE_SHUTDOWN = 4
		const isClosed = state => state === STATE_SHUTDOWN

		this.closing = true
		let alreadyClosed = false
		return new Promise((resolve, reject) => {
			const gRPC = this.client
			gRPC.getChannel().close()
			gRPC.close()
			try {
				this.channelState = gRPC
					.getChannel()
					.getConnectivityState(false)
			} catch (e: any) {
				const msg = e.toString()
				alreadyClosed =
					isClosed(this.channelState) ||
					msg.includes(
						'Cannot call getConnectivityState on a closed Channel'
					) // C-based library
			}

			const closed = isClosed(this.channelState)
			if (closed || alreadyClosed) {
				this.channelClosed = true
				this.emit(MiddlewareSignals.Log.Info, `Grpc channel closed`)
				return resolve(null) // setTimeout(() => resolve(), 2000)
			}

			this.emit(
				MiddlewareSignals.Log.Info,
				`Grpc Channel State: ${connectivityState[this.channelState]}`
			)
			const deadline = new Date().setSeconds(
				new Date().getSeconds() + 300
			)
			gRPC.getChannel().watchConnectivityState(
				this.channelState,
				deadline,
				async () => {
					try {
						this.channelState = gRPC
							.getChannel()
							.getConnectivityState(false)
						this.emit(
							MiddlewareSignals.Log.Info,
							`Grpc Channel State: ${
								connectivityState[this.channelState]
							}`
						)
						alreadyClosed = isClosed(this.channelState)
					} catch (e: any) {
						const msg = e.toString()
						alreadyClosed =
							msg.includes(
								'Cannot call getConnectivityState on a closed Channel'
							) || isClosed(this.channelState)
						this.emit(
							MiddlewareSignals.Log.Info,
							`Closed: ${alreadyClosed}`
						)
					}
					if (alreadyClosed) {
						return resolve(null)
					}
				}
			)

			return setTimeout(() => {
				// tslint:disable-next-line: no-console
				console.log(`Channel timeout after ${timeout}`) // @DEBUG

				return isClosed(this.channelState)
					? null
					: reject(
							new Error(
								`Didn't close in time: ${this.channelState}`
							)
					  )
			}, timeout)
		})
	}

	private async getAuthToken() {
		const metadata = new Metadata({ waitForReady: false })
		metadata.add('user-agent', `zeebe-client-nodejs/${pkg.version}`)
		if (this.oAuth) {
			const token = await this.oAuth.getToken()
			metadata.add('Authorization', `Bearer ${token}`)
		}
		if (this.basicAuth) {
			const token = Buffer.from(
				`${this.basicAuth.username}:${this.basicAuth.password}`
			).toString('base64')
			metadata.add('Authorization', `Basic ${token}`)
		}
		return metadata
	}

	private waitForGrpcChannelReconnect(): Promise<number> {
		this.emit(MiddlewareSignals.Log.Debug, 'Start watching Grpc channel...')
		return new Promise(resolve => {
			const tryToConnect = true
			const gRPC = this.client
			if (this.channelClosed) {
				return
			}
			const currentChannelState = gRPC
				.getChannel()
				.getConnectivityState(tryToConnect)
			this.emit(
				MiddlewareSignals.Log.Error,
				`Grpc Channel State: ${connectivityState[currentChannelState]}`
			)
			const delay =
				currentChannelState === GrpcState.TRANSIENT_FAILURE ? 5 : 30
			const deadline = new Date().setSeconds(
				new Date().getSeconds() + delay
			)
			if (
				currentChannelState === GrpcState.IDLE ||
				currentChannelState === GrpcState.READY
			) {
				this.gRPCRetryCount = 0
				return resolve(currentChannelState)
			}

			gRPC.getChannel().watchConnectivityState(
				currentChannelState,
				deadline,
				async error => {
					if (this.channelClosed) {
						return
					}
					this.gRPCRetryCount++
					if (error) {
						this.emit(MiddlewareSignals.Log.Error, error)
					}
					const newState = gRPC
						.getChannel()
						.getConnectivityState(tryToConnect)
					this.emit(
						MiddlewareSignals.Log.Error,
						`Grpc Channel State: ${connectivityState[newState]}`
					)
					this.emit(
						MiddlewareSignals.Log.Error,
						`Grpc Retry count: ${this.gRPCRetryCount}`
					)
					if (
						newState === GrpcState.READY ||
						newState === GrpcState.IDLE
					) {
						return resolve(newState)
					} else {
						this.emit(
							MiddlewareSignals.Log.Error,
							`Grpc Retry count: ${this.gRPCRetryCount}`
						)
						return resolve(await this.waitForGrpcChannelReconnect())
					}
				}
			)
		})
	}

	private setReady() {
		// debounce rapid connect / disconnect
		if (this.readyTimer) {
			this.emit(
				MiddlewareSignals.Log.Debug,
				`Reset Grpc channel ready timer.`
			)
			clearTimeout(this.readyTimer)
		}
		this.emit(
			MiddlewareSignals.Log.Debug,
			`Set Grpc channel ready timer for ${this.connectionTolerance}ms`
		)

		this.readyTimer = setTimeout(() => {
			if (this.failTimer) {
				clearTimeout(this.failTimer)
				this.failTimer = undefined
			}
			this.readyTimer = undefined
			this.connected = true
			this.emit(
				MiddlewareSignals.Log.Debug,
				`Set Grpc channel state ready after ${this.connectionTolerance}ms`
			)
			this.emit(MiddlewareSignals.Event.Ready)
		}, this.connectionTolerance)
	}

	private setNotReady() {
		if (this.readyTimer) {
			this.emit(
				MiddlewareSignals.Log.Debug,
				`Cancelled channel ready timer`
			)
			clearTimeout(this.readyTimer)
			this.readyTimer = undefined
		}
		this.connected = false
		if (!this.failTimer) {
			this.emit(
				MiddlewareSignals.Log.Debug,
				`Set Grpc channel failure timer for ${this.connectionTolerance}ms`
			)
			this.failTimer = setTimeout(() => {
				if (this.readyTimer) {
					this.failTimer = undefined
					this.emit(
						MiddlewareSignals.Log.Debug,
						`Grpc channel ready timer is running, not failing channel...`
					)
					return
				}
				this.emit(
					MiddlewareSignals.Log.Debug,
					`Set Grpc Channel state to failed after ${this.connectionTolerance}ms`
				)
				this.failTimer = undefined
				this.connected = false
				this.emit(MiddlewareSignals.Event.Error)
			}, this.connectionTolerance)
		}
	}

	// https://github.com/grpc/proposal/blob/master/L5-node-client-interceptors.md#proposal
	private interceptor = (options, nextCall) => {
		const requester = {
			start: (metadata, _, next) => {
				const newListener = {
					onReceiveStatus: (callStatus: any, nxt: any) => {
						const isError = callStatus.code !== status.OK
						if (isError) {
							if (
								callStatus.code === 1 &&
								callStatus.details.includes('503') // ||
								// callStatus.code === 13
							) {
								return this.emit(
									MiddlewareSignals.Event.GrpcInterceptError,
									{ callStatus, options }
								)
							}
							if (callStatus.code === 1 && this.closing) {
								return this.emit(
									MiddlewareSignals.Log.Debug,
									'Closing, and error received from server'
								)
							}
						}
						return nxt(callStatus)
					},
				}
				next(metadata, newListener)
			},
		}
		return new InterceptingCall(nextCall(options), requester)
	}
}
