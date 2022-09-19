import chalk from 'chalk'
import { Characteristics, State } from './ConnectionFactory'
import { ZBLoggerConfig } from './interfaces-1.0'
import { ZBLogger } from './ZBLogger'

export class StatefulLogInterceptor {
	public characteristics: Characteristics
	public log: ZBLogger
	public blocking: boolean
	public state: State = 'ERROR'
	public errors = []
	public logs = []
	public initialConnection: boolean
	private blockingTimer?: NodeJS.Timeout
	constructor({
		characteristics,
		logConfig,
	}: {
		characteristics: Characteristics
		logConfig: ZBLoggerConfig
	}) {
		this.characteristics = characteristics
		this.log = new ZBLogger(logConfig)
		this.initialConnection = false
		this.blocking =
			characteristics.startupTime > 0 && this.log.loglevel !== 'DEBUG'
		if (this.blocking) {
			this.logDirect(
				chalk.yellowBright(
					'Authenticating client with Camunda Cloud...'
				)
			)
			this.blockingTimer = setTimeout(() => {
				if (!this.blocking) {
					return
				}
				this.blocking = false
				return this.state === 'ERROR'
					? this.emptyErrors()
					: this.emptyLogs()
			}, this.characteristics.startupTime)
		}
	}

	public close() {
		if (this.blockingTimer) {
			clearTimeout(this.blockingTimer)
		}
	}

	public logError = err => this.error(err)
	public logInfo = msg => this.info(msg)
	public logDebug = (msg, ...args) => this.log.debug(msg, ...args)
	public logDirect = msg => this.log._tag === 'ZBCLIENT' && this.log.info(msg)
	public connectionError = () => {
		this.state = 'ERROR'
	}
	public ready = () => {
		this.state = 'CONNECTED'
		if (this.blocking) {
			this.blocking = false
			this.emptyLogs()
		}
	}
	private emptyErrors() {
		if (this.errors.length === 0) {
			return
		}
		this.errors.forEach(err => this.logError(err))
		this.logDirect(chalk.redBright('Error connecting to Camunda Cloud.'))
		this.errors = []
	}
	private emptyLogs() {
		if (!this.initialConnection) {
			this.initialConnection = true
			this.logDirect(
				chalk.greenBright(
					'Established encrypted connection to Camunda Cloud.'
				)
			)
		}
		if (this.logs.length === 0) {
			return
		}
		this.logs.forEach(msg => this.logInfo(msg))
		this.logs = []
	}
	private wrap = (store: string[]) => (
		logmethod: (msg: any, ...optionalParameters: any[]) => void
	) => (msg: string) => {
		if (this.blocking && this.state === 'ERROR') {
			store.push(msg)
			return
		}
		logmethod(msg)
	}
	// tslint:disable-next-line: member-ordering
	private info = this.wrap(this.logs)(m => this.log.info(m))

	// tslint:disable-next-line: member-ordering
	private error = this.wrap(this.errors)(e => this.log.error(e))
}
