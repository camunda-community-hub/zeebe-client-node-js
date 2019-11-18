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
			...ConfigurationHydrator.readBasicAuthFromEnvironment(),
			...ConfigurationHydrator.readOAuthFromEnvironment(),
			...ConfigurationHydrator.getGatewayFromEnvironment(),
			...ConfigurationHydrator.readCamundaClusterConfFromEnv(
				gatewayAddress
			),
			...ConfigurationHydrator.decodeConnectionString(gatewayAddress),
			...ConfigurationHydrator.getCamundaCloudConfig(options),
			...ConfigurationHydrator.readTLSFromEnvironment(),
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

	private static readTLSFromEnvironment() {
		const secureConnection = process.env.ZEEBE_INSECURE_CONNECTION
		if (!secureConnection) {
			return {}
		}
		const value = secureConnection.toLowerCase()
		const useTLS = value === 'false' || !(value === 'true')
		return {
			useTLS,
		}
	}

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

	private static readBasicAuthFromEnvironment(): ZB.BasicAuthConfig | {} {
		const password = process.env.ZEEBE_BASIC_AUTH_PASSWORD
		const username = process.env.ZEEBE_BASIC_AUTH_USERNAME
		return password && username
			? {
					basicAuth: {
						password,
						username,
					},
			  }
			: {}
	}

	private static readCamundaClusterConfFromEnv(explicitGateway?: string) {
		if (explicitGateway) {
			return {}
		}
		// We can either take a simple clusterId, or else the whole Zeebe Address
		// This env var is Node-client specific
		const clusterId = process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
		// This env var is compatible with zbctl and the Java and Go clients
		const zeebeAddress = process.env.ZEEBE_ADDRESS
		const name = clusterId ? clusterId : zeebeAddress
		const hostname = `${ConfigurationHydrator.justClusterId(
			name
		)}.zeebe.camunda.io`
		const audience = hostname

		const clientId = process.env.ZEEBE_CLIENT_ID
		const clientSecret = process.env.ZEEBE_CLIENT_SECRET
		return clientId
			? {
					hostname,
					oAuth: {
						audience,
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
		// ZEEBE_GATEWAY_ADDRESS is for backward compatibility. ZEEBE_ADDRESS is for compatibility with
		// the Java / Go clients (including zbctl)
		const connectionString =
			process.env.ZEEBE_GATEWAY_ADDRESS || process.env.ZEEBE_ADDRESS
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

	private static getCamundaCloudConfig(
		options: ZB.ZBClientOptions = {} as any
	) {
		if (options.camundaCloud) {
			const { camundaCloud } = options
			const clusterId = ConfigurationHydrator.justClusterId(
				camundaCloud.clusterId
			)
			const configuration: ZB.ZBClientOptions = {
				...options,
				hostname: `${clusterId}.zeebe.camunda.io`,
				oAuth: {
					audience: `${clusterId}.zeebe.camunda.io`,
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

	private static justClusterId(maybeClusterId: string | undefined) {
		// 'Be liberal in what you accept and conservative in what you emit'
		// Here we account for users pasting in either the expected clusterId
		// or the entire Zeebe ContactPoint from the Cloud Console.
		return maybeClusterId
			? maybeClusterId.split('.zeebe.camunda.io')[0]
			: undefined
	}
}
