import { parse } from 'url'
import { getEnv } from './EnvFunction'
import * as ZB from './interfaces'
import { Loglevel, ZBClientOptions } from './interfaces-published-contract'
import { OAuthProviderConfig } from './OAuthProvider'

export class ConfigurationHydrator {
	// These are the environment variables that can be used to configure the client

	public static ENV = () =>
		getEnv([
			'ZEEBE_NODE_LOG_LEVEL',
			'ZEEBE_GATEWAY_ADDRESS',
			'ZEEBE_ADDRESS',
			'ZEEBE_CLIENT_ID',
			'ZEEBE_CLIENT_SECRET',
			'ZEEBE_SECURE_CONNECTION',
			'ZEEBE_TOKEN_AUDIENCE',
			'ZEEBE_AUTHORIZATION_SERVER_URL',
			'ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID',
			'ZEEBE_BASIC_AUTH_PASSWORD',
			'ZEEBE_BASIC_AUTH_USERNAME',
			'ZEEBE_NODE_EAGER_CONNECT',
			'ZEEBE_CLIENT_RETRY',
			'ZEEBE_CLIENT_MAX_RETRIES',
			'ZEEBE_CLIENT_MAX_RETRY_TIMEOUT',
		])
	public static configure(
		gatewayAddress: string | undefined,
		options: ZBClientOptions | undefined
	) {
		// ConfigurationHydrator.warnOnAmbiguousConfig()
		const configuration = {
			hostname: 'localhost',
			port: '26500',
			...ConfigurationHydrator.readBasicAuthFromEnvironment(),
			...ConfigurationHydrator.readOAuthFromEnvironment(gatewayAddress),
			...ConfigurationHydrator.getGatewayFromEnvironment(),
			...ConfigurationHydrator.decodeConnectionString(gatewayAddress),
			...ConfigurationHydrator.getCamundaCloudConfig(options),
			...ConfigurationHydrator.readTLSFromEnvironment(options),
			...ConfigurationHydrator.getEagerStatus(options),
			...ConfigurationHydrator.getRetryConfiguration(options),
		}
		return configuration
	}
	public static readonly getLogLevelFromEnv = () =>
		ConfigurationHydrator.ENV().ZEEBE_NODE_LOG_LEVEL as Loglevel | undefined

	private static readonly DEFAULT_GATEWAY_PORT = '26500'
	private static readonly CAMUNDA_CLOUD_AUTH_SERVER =
		'https://login.cloud.camunda.io/oauth/token'

	private static readonly getClientIdFromEnv = () =>
		ConfigurationHydrator.ENV().ZEEBE_CLIENT_ID
	private static readonly getZeebeAddressFromEnv = () =>
		ConfigurationHydrator.ENV().ZEEBE_ADDRESS ||
		ConfigurationHydrator.ENV().ZEEBE_GATEWAY_ADDRESS
	private static readonly getClientSecretFromEnv = () =>
		ConfigurationHydrator.ENV().ZEEBE_CLIENT_SECRET
	private static readonly getTlsFromEnv = () =>
		(
			ConfigurationHydrator.ENV().ZEEBE_SECURE_CONNECTION || ''
		).toLowerCase() === 'true'
			? true
			: (
					ConfigurationHydrator.ENV().ZEEBE_SECURE_CONNECTION || ''
			  ).toLowerCase() === 'false'
			? false
			: undefined

	private static readTLSFromEnvironment(options: any = {}) {
		const useTLS = options.useTLS ?? ConfigurationHydrator.getTlsFromEnv()
		return {
			useTLS,
		}
	}

	private static readOAuthFromEnvironment(
		gatewayAddress
	): OAuthProviderConfig | {} {
		const clientId = ConfigurationHydrator.getClientIdFromEnv()
		const clientSecret = ConfigurationHydrator.getClientSecretFromEnv()
		const audience = ConfigurationHydrator.ENV().ZEEBE_TOKEN_AUDIENCE
		const authServerUrl = ConfigurationHydrator.ENV()
			.ZEEBE_AUTHORIZATION_SERVER_URL
		const clusterId = ConfigurationHydrator.ENV()
			.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID

		const isCamundaCloudShortcutConfig =
			clusterId || (clientId && clientSecret && !audience)
		if (isCamundaCloudShortcutConfig) {
			return ConfigurationHydrator.readCamundaClusterConfFromEnv(
				gatewayAddress
			)
		}
		return clientId && clientSecret && audience && authServerUrl
			? {
					oAuth: {
						audience,
						cacheOnDisk: true,
						clientId: clientId!,
						clientSecret,
						url: authServerUrl,
					},
					useTLS: true,
			  }
			: {}
	}

	private static readBasicAuthFromEnvironment(): ZB.BasicAuthConfig | {} {
		const password = ConfigurationHydrator.ENV().ZEEBE_BASIC_AUTH_PASSWORD
		const username = ConfigurationHydrator.ENV().ZEEBE_BASIC_AUTH_USERNAME
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
		const clusterId = ConfigurationHydrator.ENV()
			.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
		// This env var is compatible with zbctl and the Java and Go clients
		const zeebeAddress = ConfigurationHydrator.getZeebeAddressFromEnv()
		const name = clusterId ? clusterId : zeebeAddress
		const hostname = `${ConfigurationHydrator.justClusterId(
			name
		)}.zeebe.camunda.io`
		const audience = hostname

		const clientId = ConfigurationHydrator.getClientIdFromEnv()
		const clientSecret = ConfigurationHydrator.getClientSecretFromEnv()

		const url =
			ConfigurationHydrator.ENV().ZEEBE_AUTHORIZATION_SERVER_URL ||
			ConfigurationHydrator.CAMUNDA_CLOUD_AUTH_SERVER
		return clientId
			? {
					hostname,
					oAuth: {
						audience,
						cacheDir: undefined, // will be set in OAuthProvider
						cacheOnDisk: true,
						clientId: clientId!,
						clientSecret: clientSecret!,
						url,
					},
					port: '443',
					useTLS: true,
			  }
			: {}
	}

	private static getGatewayFromEnvironment() {
		// ZEEBE_GATEWAY_ADDRESS is for backward compatibility. ZEEBE_ADDRESS is for compatibility with
		// the Java / Go clients (including zbctl)
		const connectionString = ConfigurationHydrator.getZeebeAddressFromEnv()

		return connectionString
			? ConfigurationHydrator.decodeConnectionString(connectionString)
			: {}
	}

	private static decodeConnectionString(
		connectionString: string | undefined
	) {
		if (!connectionString) {
			connectionString = ConfigurationHydrator.getZeebeAddressFromEnv()
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

	private static getCamundaCloudConfig(options: ZBClientOptions = {} as any) {
		if (options.camundaCloud) {
			const { camundaCloud } = options
			const clusterId = ConfigurationHydrator.justClusterId(
				camundaCloud.clusterId
			)
			const configuration: ZBClientOptions = {
				...options,
				hostname: `${clusterId}.zeebe.camunda.io`,
				oAuth: {
					audience: `${clusterId}.zeebe.camunda.io`,
					cacheDir: camundaCloud.cacheDir,
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

	private static getEagerStatus(options: ZBClientOptions | undefined) {
		return {
			eagerConnection:
				(
					ConfigurationHydrator.ENV().ZEEBE_NODE_EAGER_CONNECT ||
					'false'
				).toLocaleLowerCase() === 'true' ||
				options?.eagerConnection === true,
		}
	}

	private static getRetryConfiguration(options: ZBClientOptions | undefined) {
		return {
			retry:
				(
					ConfigurationHydrator.ENV().ZEEBE_CLIENT_RETRY || 'false'
				).toLocaleLowerCase() === 'true' || options?.retry === true,
			maxRetries: parseInt(
				ConfigurationHydrator.ENV().ZEEBE_CLIENT_MAX_RETRIES,
				10
			),
			maxRetryTimeout: parseInt(
				ConfigurationHydrator.ENV().ZEEBE_CLIENT_MAX_RETRY_TIMEOUT,
				10
			),
		}
	}
}
