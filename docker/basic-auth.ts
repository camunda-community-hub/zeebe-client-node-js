import { ZBClient } from '../src'

// Add an entry to your /etc/hosts to resolve zeebe.docker.localhost to 127.0.0.1

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
