import { ZBClient } from '../src'

const z = new ZBClient('zeebe.docker.localhost:80', {
	basicAuth: {
		password: 'test',
		username: 'test',
	},
})

async function main() {
	// tslint:disable-next-line: no-console
	console.log(await z.topology())
	z.createWorker(null, 't', (_, complete) => {
		complete.success()
	})
}

main()
