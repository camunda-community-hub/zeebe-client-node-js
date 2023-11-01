import { ConnectionStatusEvent } from '../zb/ZBClient'
import { Characteristics, State } from './ConnectionFactory'
import { GrpcClient, GrpcClientCtor, MiddlewareSignals } from './GrpcClient'
import { StatefulLogInterceptor } from './StatefulLogInterceptor'

export class GrpcMiddleware {
	public blocking: boolean
	public state: State
	public log: StatefulLogInterceptor
	private grpcClient: GrpcClient
	private characteristics: Characteristics
	private blockingTimer?: NodeJS.Timeout

	constructor({
		characteristics,
		config,
		log,
	}: {
		characteristics: Characteristics
		config: GrpcClientCtor
		log: StatefulLogInterceptor
	}) {
		this.characteristics = characteristics
		this.blocking = this.characteristics.startupTime > 0
		this.state = 'UNKNOWN'
		log.logDebug(`Grpc Middleware blocking: ${this.blocking}`)
		if (this.blocking) {
			this.blockingTimer = setTimeout(() => {
				this.blocking = false
				log.logDebug(`Grpc Middleware state: ${this.state}`)
				if (this.state === 'ERROR') {
					this.emitError(new Error(`Did not establish connection before deadline ${this.characteristics.startupTime}ms`))
				} else if (this.state === 'CONNECTED') {
					this.emitReady()
				} else if (this.state === 'UNKNOWN') {
					this.grpcClient.emit(ConnectionStatusEvent.unknown)
				}
			}, this.characteristics.startupTime)
		}
		this.log = log
		this.grpcClient = this.createInterceptedGrpcClient(config)
	}
	public getGrpcClient = () => this.grpcClient

	private createInterceptedGrpcClient(config: GrpcClientCtor) {
		const grpcClient = new GrpcClient(config)
		const logInterceptor = this.log
		const _close = grpcClient.close.bind(grpcClient)
		grpcClient.close = async () => {
			if (this.blockingTimer) {
				clearTimeout(this.blockingTimer)
			}
			_close()
			return null
		}
		grpcClient.on(MiddlewareSignals.Log.Debug, logInterceptor.logDebug)
		grpcClient.on(MiddlewareSignals.Log.Info, logInterceptor.logInfo)
		grpcClient.on(MiddlewareSignals.Log.Error, logInterceptor.logError)
		grpcClient.on(MiddlewareSignals.Event.Error, (err) => {
			this.state = 'ERROR'
			logInterceptor.connectionError()
			if (!this.blocking) {
				this.emitError(err)
			}
		})
		grpcClient.on(MiddlewareSignals.Event.Ready, () => {
			this.state = 'CONNECTED'
			logInterceptor.ready()
			if (!this.blocking) {
				this.emitReady()
				logInterceptor.logDebug(`Middleware emits ready`)
			} else {
				logInterceptor.logDebug(`Blocked ready emit`)
			}
		})
		grpcClient.on(
			MiddlewareSignals.Event.GrpcInterceptError,
			this.handleExceptionalGrpc
		)
		return grpcClient
	}

	private emitError = (err: Error) =>
		this.grpcClient.emit(ConnectionStatusEvent.connectionError, err)
	private emitReady = () => this.grpcClient.emit(ConnectionStatusEvent.ready)
	private handleExceptionalGrpc = ({
		callStatus,
		options,
	}: {
		callStatus: GrpcCallStatus
		options: GrpcOptions
	}) => {
		if (options.method_definition.path === 'not-happening') {
			this.log.logDebug(
				'This is to stop the compiler choking on an unused parameter while I figure out which cases to handle.'
			)
		}
		if (callStatus.code === 1 && callStatus.details.includes('503')) {
			this.log.logError(
				'The gateway returned HTTP Error 503 (Bad Gateway). This can be a transient failure while a Kubernetes node in Camunda Cloud is being pre-empted.'
			)
		}
	}
}

interface GrpcCallStatus {
	code: number
	details: string
}
interface GrpcOptions {
	method_definition: {
		/** The full path of the call, i.e. '/gateway_protocol.Gateway/SetVariables' */
		path: string
		requestStream: boolean
		responseStream: boolean
	}
}
