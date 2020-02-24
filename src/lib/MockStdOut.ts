import { ZBCustomLogger, ZBLogMessage } from './interfaces'
export class MockStdOut implements ZBCustomLogger {
	public messages: ZBLogMessage[] = []

	public info(message: ZBLogMessage) {
		this.messages.push(message)
	}

	public error(message: ZBLogMessage) {
		this.messages.push(message)
	}
}
