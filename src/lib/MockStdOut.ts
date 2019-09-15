export class MockStdOut {
	public messages: string[] = []

	public info(message: string) {
		this.messages.push(message)
	}

	public error(message: string) {
		// tslint:disable-next-line: no-console
		console.log(arguments)
		this.messages.push(message)
	}
}
