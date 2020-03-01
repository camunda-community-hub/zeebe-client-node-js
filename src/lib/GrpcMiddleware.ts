import { Characteristics, State } from './ConnectionFactory'
import { GrpcClient, GrpcClientCtor, MiddlewareSignals } from './GrpcClient'
import { StatefulLogInterceptor } from './StatefulLogInterceptor'

export class GrpcMiddleware {
	public blocking: boolean
	public state: State
	public log: StatefulLogInterceptor
	private grpcClient: GrpcClient
	private characteristics: Characteristics

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
		this.state = this.blocking ? 'ERROR' : 'CONNECTED'
		if (this.blocking) {
			setTimeout(() => {
				this.blocking = false
				if (this.state === 'ERROR') {
					this.emitError()
				} else {
					this.emitReady()
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
		grpcClient.on(MiddlewareSignals.Log.Debug, logInterceptor.logDebug)
		grpcClient.on(MiddlewareSignals.Log.Info, logInterceptor.logInfo)
		grpcClient.on(MiddlewareSignals.Log.Error, logInterceptor.logError)
		grpcClient.on(MiddlewareSignals.Event.Error, () => {
			this.state = 'ERROR'
			logInterceptor.connectionError()
			if (!this.blocking) {
				this.emitError()
			}
		})
		grpcClient.on(MiddlewareSignals.Event.Ready, () => {
			this.state = 'CONNECTED'
			logInterceptor.ready()
			if (!this.blocking) {
				this.emitReady()
			}
		})
		return grpcClient
	}

	private emitError = () => this.grpcClient.emit('connectionError')
	private emitReady = () => this.grpcClient.emit('ready')
}
