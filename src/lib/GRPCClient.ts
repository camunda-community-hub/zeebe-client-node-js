import { loadSync, Options, PackageDefinition } from '@grpc/proto-loader'
import { Client, credentials, loadPackageDefinition } from 'grpc'

export class GRPCClient {
	private packageDefinition: PackageDefinition
	private client: Client
	private listNameMethods: string[]

	constructor(
		protoPath: string,
		packageName: string,
		service: string,
		host: string,
		options: Options = {},
		tls: boolean = false
	) {
		this.packageDefinition = loadSync(protoPath, {
			defaults: options.defaults === undefined ? true : options.defaults,
			enums: options.enums === undefined ? String : options.enums,
			keepCase: options.keepCase === undefined ? true : options.keepCase,
			longs: options.longs === undefined ? String : options.longs,
			oneofs: options.oneofs === undefined ? true : options.oneofs,
		})

		const proto = loadPackageDefinition(this.packageDefinition)[packageName]
		const listMethods = this.packageDefinition[`${packageName}.${service}`]
		const channelCredentials = tls
			? credentials.createSsl()
			: credentials.createInsecure()
		this.client = new proto[service](host, channelCredentials)
		this.listNameMethods = []

		for (const key in listMethods) {
			if (listMethods[key]) {
				const methodName = listMethods[key].originalName
				this.listNameMethods.push(methodName)

				this[`${methodName}Async`] = (data, fnAnswer) => {
					this.client[methodName](data, fnAnswer)
				}

				this[`${methodName}Stream`] = data => {
					return this.client[methodName](data)
				}

				this[`${methodName}Sync`] = data => {
					const client = this.client
					return new Promise((resolve, reject) => {
						client[methodName](data, (err, dat) => {
							if (err) {
								return reject(err)
							}
							resolve(dat)
						})
					})
				}
			}
		}
	}

	public runService(fnName, data, fnAnswer) {
		this.client[fnName](data, fnAnswer)
	}

	public listMethods() {
		return this.listNameMethods
	}
}
