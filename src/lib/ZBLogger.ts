import { Chalk } from 'chalk'
import { Loglevel, ZBWorkerLoggerOptions } from './interfaces'

export class ZBLogger {
	public loglevel: Loglevel
	private colorFn: Chalk
	private namespace?: string
	private taskType?: string
	private id?: string
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

	public info(message: any, ...optionalParameters) {
		this.log(message, optionalParameters)
	}

	public error(message, ...optionalParameters: any[]) {
		if (this.loglevel === 'NONE') {
			return
		}
		if (optionalParameters.length > 0) {
			return this.stdout.error(message, optionalParameters)
		} else {
			return this.stdout.error(message)
		}
	}

	public debug(message, ...optionalParameters: any[]) {
		if (this.loglevel !== 'DEBUG') {
			return
		}
		this.log(message, optionalParameters)
	}

	public log(message: any, ...optionalParameters: any[]) {
		if (this.loglevel === 'NONE' || this.loglevel === 'ERROR') {
			return
		}
		if (this.stdout === console) {
			let msg
			if (this.colorise) {
				msg =
					this.getMetadataString() +
					' > ' +
					this.stringifyJSON(message)
				if (optionalParameters) {
					msg +=
						' ' +
						optionalParameters
							.map(o => this.stringifyJSON(o))
							.join(' ')
				}
			}
			this.stdout.info(this._colorise(msg))
		} else {
			this.stdout.info(message, optionalParameters)
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
