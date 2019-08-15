import chalk, { Chalk } from 'chalk'
import dayjs from 'dayjs'
import { Loglevel, ZBWorkerLoggerOptions } from './interfaces'

export class ZBLogger {
	public loglevel: Loglevel
	private colorFn: Chalk
	private taskType: string
	private id?: string
	private stdout: any
	private colorise: boolean
	private pollMode: string

	constructor({
		loglevel,
		color,
		namespace,
		stdout,
		id,
		taskType,
		colorise,
		pollMode,
	}: ZBWorkerLoggerOptions & {
		id?: string
		colorise?: boolean
	}) {
		this.colorFn = color || ((m => m) as any)
		this.taskType = taskType
		this.id = id
		if (Array.isArray(namespace)) {
			namespace = namespace.join(' ')
		}
		this.loglevel = loglevel
		this.stdout = stdout || console
		this.colorise = colorise !== false
		this.pollMode = pollMode || ''
	}

	public info(message: any, ...optionalParameters) {
		this.log(message, optionalParameters)
	}

	public error(message, ...optionalParameters: any[]) {
		if (this.loglevel === 'NONE') {
			return
		}
		const msg =
			optionalParameters.length > 0
				? this.makeMessage(message, optionalParameters)
				: this.makeMessage(message)
		this.stdout.error(chalk.red(msg))
	}

	public debug(message: any, ...optionalParameters: any[]) {
		if (this.loglevel !== 'DEBUG') {
			return
		}
		const msg =
			optionalParameters.length > 0
				? this.makeMessage(message, optionalParameters)
				: this.makeMessage(message)
		if (this.stdout === console) {
			this.stdout.info(this._colorise(msg))
		} else {
			this.stdout.info(msg)
		}
	}

	public log(message: any, ...optionalParameters: any[]) {
		if (this.loglevel === 'NONE' || this.loglevel === 'ERROR') {
			return
		}
		const msg =
			optionalParameters.length > 0
				? this.makeMessage(message, optionalParameters)
				: this.makeMessage(message)
		if (this.stdout === console) {
			this.stdout.info(this._colorise(msg))
		} else {
			this.stdout.info(msg)
		}
	}

	private makeMessage(message, ...optionalParameters) {
		const msg = {
			id: this.id,
			message,
			pollMode: this.pollMode,
			taskType: this.taskType,
			time: dayjs().format('YYYY MMM-DD HH:mm:ssA'),
			timestamp: new Date(),
		}

		if (optionalParameters.length > 0) {
			;(msg as any).data = optionalParameters
		}
		return JSON.stringify(msg)
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
}
