export class MockStdOut {
	public messages: string[] = []

	public info(message: string) {
		this.messages.push(message)
	}

	public error(message: string) {
		this.messages.push(message)
	}
}
