import { ZBCustomLogger } from './interfaces-published-contract'
export class MockStdOut implements ZBCustomLogger {
	public messages: string[] = []

	public info(message: string) {
		this.messages.push(message)
	}

	public error(message: string) {
		this.messages.push(message)
	}

	public debug(message: string) {
		this.messages.push(message)
	}
}
