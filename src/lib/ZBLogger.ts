import { Chalk } from 'chalk'
import { Loglevel, ZBWorkerLoggerOptions } from './interfaces'

export class ZBLogger {
	public loglevel: Loglevel
	private colorFn: Chalk
	private namespace?: string
	private taskType?: string
	private id?: string
	private enabled = true
	private stdout: any
	private colorise: boolean

	constructor(
		{
			loglevel,
			color,
			namespace,
			stdout,
			id,
			taskType,
			colorise,
		}: ZBWorkerLoggerOptions & {
			id?: string
			taskType?: string
			colorise?: boolean
		} = { loglevel: 'INFO' }
	) {
		if (color) {
			this.colorFn = color
		} else {
			this.colorFn = (m => m) as any
		}
		this.taskType = taskType
		this.id = id
		if (Array.isArray(namespace)) {
			namespace = namespace.join(' ')
		}
		this.loglevel = loglevel
		this.stdout = stdout || console
		this.colorise = colorise !== false
	}

	public info(message: any, ...optionalParameters: any[]) {
		this.log(message, optionalParameters)
	}

	public log(message: any, ...optionalParameters: any[]) {
		if (this.loglevel === 'NONE' || this.loglevel === 'ERROR') {
			return
		}
		const method =
			(this.stdout && this.stdout && this.stdout.log) || console.log // tslint:disable-line

		this._log(method, message, optionalParameters)
	}

	public error(message, ...optionalParameters: any[]) {
		if (this.loglevel === 'NONE') {
			return
		}
		const method =
			(this.stdout && this.stdout && this.stdout.error) || console.error // tslint:disable-line
		if (optionalParameters.length > 0) {
			return method(message, optionalParameters)
		} else {
			return method(message)
		}
	}

	public debug(message, ...optionalParameters: any[]) {
		if (this.loglevel !== 'DEBUG') {
			return
		}
		const method =
			(this.stdout && this.stdout && this.stdout.log) || console.log // tslint:disable-line

		this._log(method, message, optionalParameters)
	}

	private _log(logMethod, message: any, ...optionalParameters: any[]) {
		if (!this.enabled || this.loglevel === 'NONE') {
			return
		}
		if (this.stdout === console) {
			logMethod(
				this._colorise(
					this.getMetadataString() +
						' > ' +
						this.stringifyJSON(message) +
						' ' +
						optionalParameters[0]
							.map(o => this.stringifyJSON(o))
							.join(' ')
				)
			)
		} else {
			logMethod(message, optionalParameters)
		}
	}

	private _colorise(message: string) {
		if (this.stdout === console && this.colorise) {
			// Only colorise console
			if (this.colorFn && typeof this.colorFn === 'function') {
				return this.colorFn(message)
			} else {
				return message
			}
		}
		return message
	}
	private getMetadataString() {
		return '[ ' + this.getId() + this.getNamespace() + ' ]'
	}
	private getId() {
		return `${this.taskType} ${this.id}`
	}

	private stringifyJSON(message: any) {
		let parsedMessage = message

		if (
			message &&
			typeof message === 'object' &&
			!(message instanceof Error)
		) {
			try {
				parsedMessage = JSON.stringify(message, null, 2)
			} catch (e) {
				parsedMessage = message
			}
		}
		if (message instanceof Error) {
			const getStackTrace = () => {
				const obj = {} as any
				Error.captureStackTrace(obj, getStackTrace)
				return obj.stack
			}

			return getStackTrace()
		}
		return parsedMessage
	}

	private getNamespace() {
		return this.namespace ? ` ${this.namespace}` : ''
	}
}
