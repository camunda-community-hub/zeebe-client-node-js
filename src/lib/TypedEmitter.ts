import { EventEmitter } from 'events'

type EventMap = Record<string, any>

type EventKey<T extends EventMap> = string & keyof T
type EventReceiver = () => void

interface Emitter<T extends EventMap> {
	on<K extends EventKey<T>>(eventName: K, fn: EventReceiver): void
	off<K extends EventKey<T>>(eventName: K, fn: EventReceiver): void
	emit<K extends EventKey<T>>(eventName: K, params?: T[K]): void
}

export class TypedEmitter<T extends EventMap> implements Emitter<T> {
	private emitter = new EventEmitter()
	public on<K extends EventKey<T>>(eventName: K, fn: EventReceiver) {
		this.emitter.on(eventName, fn)
		return this
	}

	public off<K extends EventKey<T>>(eventName: K, fn: EventReceiver) {
		this.emitter.off(eventName, fn)
	}

	public emit<K extends EventKey<T>>(eventName: K, params?: T[K]) {
		this.emitter.emit(eventName, params)
	}

	public removeAllListeners() {
		this.emitter.removeAllListeners()
	}
}
