import { Chalk } from 'chalk'
import { ZBWorkerLoggerOptions } from './interfaces'

export class ZBWorkerLogger {
	public level?: string
	private color: Chalk
	private namespace?: string
	private taskType: string
	private id: string
	private enabled = true

	constructor(
		{ level, color, namespace }: ZBWorkerLoggerOptions = {},
		{ id, taskType }: { id: string; taskType: string }
	) {
		if (color) {
			this.color = color
		} else {
			this.color = (m => m) as any
		}
		this.taskType = taskType
		this.id = id
		if (Array.isArray(namespace)) {
			namespace = namespace.join(' ')
		}
		this.namespace = namespace
		this.level = level
	}

	public log(message) {
		if (!this.enabled) {
			return
		}
		// tslint:disable-next-line
		console.log(
			this.color(
				this.getMetadataString() + ' > ' + this.stringifyJSON(message)
			)
		)
	}

	private getMetadataString() {
		return '[ ' + this.getId() + this.getNamespace() + ' ]'
	}
	private getId() {
		return `${this.taskType} ${this.id}`
	}

	private stringifyJSON(message: any) {
		let parsedMessage = message

		if (typeof message === 'object') {
			try {
				parsedMessage = JSON.stringify(message)
			} catch (e) {
				parsedMessage = message
			}
		}
		return parsedMessage
	}

	private getNamespace() {
		return this.namespace ? ` ${this.namespace}` : ''
	}
}
