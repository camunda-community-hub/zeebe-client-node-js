import { parse } from 'url'
import * as ZB from './interfaces'
import { OAuthProviderConfig } from './OAuthProvider'

export class ConfigurationHydrator {
	public static configure(
		gatewayAddress: string | undefined,
		options: ZB.ZBClientOptions | undefined
	) {
		// ConfigurationHydrator.warnOnAmbiguousConfig()
		const configuration = {
			hostname: 'localhost',
			port: '26500',
			...ConfigurationHydrator.readOAuthFromEnvironment(),
			...ConfigurationHydrator.getGatewayFromEnvironment(),
			...ConfigurationHydrator.readCamundaClusterConfFromEnv(
				gatewayAddress
			),
			...ConfigurationHydrator.decodeConnectionString(gatewayAddress),
			...ConfigurationHydrator.getCamundaCloudConfig(options),
		}
		return configuration
	}

	private static readonly DEFAULT_GATEWAY_PORT = '26500'
	private static readonly CAMUNDA_CLOUD_AUTH_SERVER =
		'https://login.cloud.camunda.io/oauth/token'

	// private static warnOnAmbiguousConfig() {
	// Ambiguous confs:
	// No explicit gateway. ZEEBE_GATEWAY_ADDRESS & CLUSTER_ID set
	// Explicit gateway & options.camundaCloud

	// }

	private static readOAuthFromEnvironment(): OAuthProviderConfig | {} {
		const clientId = process.env.ZEEBE_CLIENT_ID
		const clientSecret = process.env.ZEEBE_CLIENT_SECRET
		const audience = process.env.ZEEBE_TOKEN_AUDIENCE
		const authServerUrl = process.env.ZEEBE_AUTHORIZATION_SERVER_URL
		const clusterId = process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID

		if (clusterId) {
			return {} // will be handled in the CamundaCloud Config
		}
		return clientId && clientSecret && audience && authServerUrl
			? {
					oAuth: {
						audience,
						cacheOnDisk: true,
						clientId: clientId!,
						clientSecret,
						url: authServerUrl,
						useTLS: true,
					},
			  }
			: {}
	}

	private static readCamundaClusterConfFromEnv(explicitGateway?: string) {
		if (explicitGateway) {
			return {}
		}
		const clusterId = process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
		const clientId = process.env.ZEEBE_CLIENT_ID
		const clientSecret = process.env.ZEEBE_CLIENT_SECRET
		return clusterId
			? {
					hostname: `${clusterId}.zeebe.camunda.io`,
					oAuth: {
						audience: `${clusterId}.zeebe.camunda.io`,
						cacheOnDisk: true,
						clientId: clientId!,
						clientSecret: clientSecret!,
						url: ConfigurationHydrator.CAMUNDA_CLOUD_AUTH_SERVER,
					},
					port: '443',
					useTLS: true,
			  }
			: {}
	}

	private static getGatewayFromEnvironment() {
		const connectionString = process.env.ZEEBE_GATEWAY_ADDRESS
		return connectionString
			? ConfigurationHydrator.decodeConnectionString(connectionString)
			: {}
	}

	private static decodeConnectionString(
		connectionString: string | undefined
	) {
		if (!connectionString) {
			connectionString = process.env.ZEEBE_GATEWAY_ADDRESS
			if (!connectionString) {
				return {}
			}
		}
		const includesProtocol = connectionString.includes('://')
		const gatewayAddress = includesProtocol
			? connectionString
			: `zeebe://${connectionString}`
		const url = parse(gatewayAddress)
		url.port = url.port || ConfigurationHydrator.DEFAULT_GATEWAY_PORT
		url.hostname = url.hostname || url.path
		return {
			hostname: url.hostname,
			port: url.port,
		}
	}

	private static getCamundaCloudConfig(options: ZB.ZBClientOptions = {}) {
		if (options.camundaCloud) {
			const { camundaCloud } = options
			const configuration: ZB.ZBClientOptions = {
				...options,
				hostname: `${camundaCloud.clusterId}.zeebe.camunda.io`,
				oAuth: {
					audience: `${camundaCloud.clusterId}.zeebe.camunda.io`,
					cacheOnDisk: camundaCloud.cacheOnDisk !== false,
					clientId: camundaCloud.clientId,
					clientSecret: camundaCloud.clientSecret,
					url: ConfigurationHydrator.CAMUNDA_CLOUD_AUTH_SERVER,
				},
				port: '443',
				useTLS: true,
			}
			return configuration
		}
		return options
	}
}
