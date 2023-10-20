import { ConfigurationHydrator } from '../lib/ConfigurationHydrator'

jest.mock('fs');

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
// const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

const STORED_ENV = {}
const ENV_VARS_TO_STORE = [
	'ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID',
	'ZEEBE_CLIENT_SECRET',
	'ZEEBE_CLIENT_ID',
	'ZEEBE_GATEWAY_ADDRESS',
	'ZEEBE_ADDRESS',
	'ZEEBE_TOKEN_AUDIENCE',
	'ZEEBE_AUTHORIZATION_SERVER_URL',
	'ZEEBE_CLIENT_MAX_RETRIES',
	'ZEEBE_CLIENT_RETRY',
	'ZEEBE_CLIENT_MAX_RETRY_TIMEOUT',
	'ZEEBE_CLIENT_SSL_ROOT_CERTS_PATH',
	'ZEEBE_CLIENT_SSL_PRIVATE_KEY_PATH',
	'ZEEBE_CLIENT_SSL_CERT_CHAIN_PATH',
	'ZEEBE_TENANT_ID'
]

beforeAll(() => {
	ENV_VARS_TO_STORE.forEach(e => {
		STORED_ENV[e] = process.env[e]
		delete process.env[e]
	})
})

afterAll(() => {
	ENV_VARS_TO_STORE.forEach(e => {
		delete process.env[e]
		if (STORED_ENV[e]) {
			process.env[e] = STORED_ENV[e]
		}
	})
})
test('Has a zero-conf for localhost:26500', () => {
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.hostname).toBe('localhost')
	expect(conf.port).toBe('26500')
})
test('Has a zero-conf that uses ZEEBE_GATEWAY_ADDRESS from the env with zeebe:// protocol', () => {
	process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://my-server:26600'
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.hostname).toBe('my-server')
	expect(conf.port).toBe('26600')
})
test('Has a zero-conf that uses ZEEBE_GATEWAY_ADDRESS from the env without zeebe:// protocol', () => {
	process.env.ZEEBE_GATEWAY_ADDRESS = 'my-server:26600'
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.hostname).toBe('my-server')
	expect(conf.port).toBe('26600')
})
test('Decodes a zeebe://hostname with default port', () => {
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	const conf = ConfigurationHydrator.configure('zeebe://zeebe.io', undefined)
	expect(conf.hostname).toBe('zeebe.io')
	expect(conf.port).toBe('26500')
})
test('Decodes a zeebe://hostname:port', () => {
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	const conf = ConfigurationHydrator.configure(
		'zeebe://zeebe.io:26600',
		undefined
	)
	expect(conf.hostname).toBe('zeebe.io')
	expect(conf.port).toBe('26600')
})
test('Decodes a zeebe://hostname:port', () => {
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	const conf = ConfigurationHydrator.configure(
		'zeebe://zeebe.io:26600',
		undefined
	)
	expect(conf.hostname).toBe('zeebe.io')
	expect(conf.port).toBe('26600')
})
test('Decodes a hostname:port', () => {
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	const conf = ConfigurationHydrator.configure('zeebe.io:26600', undefined)
	expect(conf.hostname).toBe('zeebe.io')
	expect(conf.port).toBe('26600')
})
test('Takes an explicit Gateway address over the environment ZEEBE_GATEWAY_ADDRESS', () => {
	process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(
		'zeebe://zeebe.io:26600',
		undefined
	)
	expect(conf.hostname).toBe('zeebe.io')
	expect(conf.port).toBe('26600')
})

/**
 * Camunda Cloud
 */
test('Constructs the Camunda Cloud connection from the environment with clusterId', () => {
	process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID =
		'103ca930-6da6-4df7-aa97-941eb1f85040'
	process.env.ZEEBE_CLIENT_SECRET =
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	process.env.ZEEBE_CLIENT_ID = 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh'
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

test('Constructs the Camunda Cloud connection from the environment with ZEEBE_ADDRESS with no change to URL', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS

	process.env.ZEEBE_ADDRESS =
		'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io:443'
	process.env.ZEEBE_CLIENT_SECRET =
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	process.env.ZEEBE_CLIENT_ID = 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh'

	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

// @TODO
test('Constructs the Camunda Cloud connection from the environment with ZEEBE_ADDRESS in Belgium region', () => {
	process.env.ZEEBE_ADDRESS =
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io:443'
	process.env.ZEEBE_CLIENT_SECRET =
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	process.env.ZEEBE_CLIENT_ID = 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh'
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

test('Constructs the Camunda Cloud connection with default region from a CamundaCloudConfig with just three parameters', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_CLIENT_SECRET
	delete process.env.ZEEBE_CLIENT_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(undefined, {
		camundaCloud: {
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			// file deepcode ignore HardcodedNonCryptoSecret/test: <please specify a reason of ignoring this>
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
		},
	})
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

test('Caches the JWT from Camunda Cloud by default', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_CLIENT_SECRET
	delete process.env.ZEEBE_CLIENT_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(undefined, {
		camundaCloud: {
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
		},
	})
	expect(conf.oAuth!.cacheOnDisk).toBe(true)
})
test('Does not cache the JWT from Camunda Cloud if specified', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_CLIENT_SECRET
	delete process.env.ZEEBE_CLIENT_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(undefined, {
		camundaCloud: {
			cacheOnDisk: false,
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
		},
	})
	expect(conf.oAuth!.cacheOnDisk).toBe(false)
})
test('Takes a CamundaCloudConfig over the environment', () => {
	process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID = 'xxxx'
	process.env.ZEEBE_CLIENT_SECRET = 'xxxx'
	process.env.ZEEBE_CLIENT_ID = 'xxxx'
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(undefined, {
		camundaCloud: {
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
		},
	})
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})
test('Uses an explicit gateway over the environment Camunda Cloud config', () => {
	process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID =
		'103ca930-6da6-4df7-aa97-941eb1f85040'
	process.env.ZEEBE_CLIENT_SECRET =
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	process.env.ZEEBE_CLIENT_ID = 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh'
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure(
		'zeebe://localhost:26500',
		undefined
	)
	expect(conf.hostname).toBe('localhost')
	expect(conf.port).toBe('26500')
	expect(conf.oAuth).toBe(undefined)
})
test('Uses the Camunda Cloud connection from a CamundaCloudConfig, overriding the explicit gateway', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_CLIENT_SECRET
	delete process.env.ZEEBE_CLIENT_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure('localhost:26600', {
		camundaCloud: {
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
		},
	})
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

test('Defaults the region to bru-2 when passed a CamundaCloudConfig with no clusterRegion', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_CLIENT_SECRET
	delete process.env.ZEEBE_CLIENT_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure('localhost:26600', {
		camundaCloud: {
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
		},
	})
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.bru-2.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

test('Uses the explicit region passed in a CamundaCloudConfig', () => {
	delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
	delete process.env.ZEEBE_CLIENT_SECRET
	delete process.env.ZEEBE_CLIENT_ID
	delete process.env.ZEEBE_GATEWAY_ADDRESS
	// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
	const conf = ConfigurationHydrator.configure('localhost:26600', {
		camundaCloud: {
			clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
			clientSecret:
				'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
			clusterId: '103ca930-6da6-4df7-aa97-941eb1f85040',
			clusterRegion: 'us-1',
		},
	})
	expect(conf.hostname).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.us-1.zeebe.camunda.io'
	)
	expect(conf.port).toBe('443')
	expect(conf.oAuth!.audience).toBe(
		'103ca930-6da6-4df7-aa97-941eb1f85040.us-1.zeebe.camunda.io'
	)
	expect(conf.oAuth!.url).toBe('https://login.cloud.camunda.io/oauth/token')
	expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
	expect(conf.oAuth!.clientSecret).toBe(
		'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
	)
})

describe('Configures secure connection with custom root certs', () => {
	test('to Camunda Cloud, oAuth inherits <customSSL.rootCerts>', () => {
		delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
		delete process.env.ZEEBE_CLIENT_SECRET
		delete process.env.ZEEBE_CLIENT_ID
		delete process.env.ZEEBE_GATEWAY_ADDRESS

		const rootCerts = Buffer.from('CERT', 'utf8')

		// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
		const conf = ConfigurationHydrator.configure('localhost:26600', {
			camundaCloud: {
				clientId: 'CLIENT_ID',
				clientSecret: 'CLIENT_SECRET',
				clusterId: 'CLUSTER_ID',
				clusterRegion: 'CLUSTER_REGION',
			},
			useTLS: true,
			customSSL: {
				rootCerts,
			},
		})

		expect(conf.oAuth!.url).toBe(
			'https://login.cloud.camunda.io/oauth/token'
		)
		expect(conf.oAuth!.customRootCert).toBe(rootCerts)
	})

	test('to Self-managed, oAuth uses <oAuth.customRootCert>', () => {
		delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
		delete process.env.ZEEBE_CLIENT_SECRET
		delete process.env.ZEEBE_CLIENT_ID
		delete process.env.ZEEBE_GATEWAY_ADDRESS

		const rootCerts = Buffer.from('CERT', 'utf8')
		const oAuthRootCerts = Buffer.from('C_CERT', 'utf8')

		// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
		const conf = ConfigurationHydrator.configure('localhost:26600', {
			oAuth: {
				audience: 'OAUTH_AUDIENCE',
				clientId: 'CLIENT_ID',
				clientSecret: 'CLIENT_SECRET',
				url: 'OAUTH_URL',
				customRootCert: oAuthRootCerts,
			},
			useTLS: true,
			customSSL: {
				rootCerts,
			},
		})

		expect(conf.oAuth!.url).toBe('OAUTH_URL')
		expect(conf.oAuth!.customRootCert).toBe(oAuthRootCerts)
		expect(conf.customSSL?.rootCerts).toBe(rootCerts)
	})

	test('to Self-managed, oAuth inherits <customSSL.rootCerts>', () => {
		delete process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
		delete process.env.ZEEBE_CLIENT_SECRET
		delete process.env.ZEEBE_CLIENT_ID
		delete process.env.ZEEBE_GATEWAY_ADDRESS

		const rootCerts = Buffer.from('CERT', 'utf8')

		// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
		const conf = ConfigurationHydrator.configure('localhost:26600', {
			oAuth: {
				audience: 'OAUTH_AUDIENCE',
				clientId: 'CLIENT_ID',
				clientSecret: 'CLIENT_SECRET',
				url: 'OAUTH_URL',
			},
			useTLS: true,
			customSSL: {
				rootCerts,
			},
		})

		expect(conf.oAuth!.url).toBe('OAUTH_URL')
		expect(conf.oAuth!.customRootCert).toBe(rootCerts)
	})
})

test('Is insecure by default', () => {
	delete process.env.ZEEBE_INSECURE_CONNECTION
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.useTLS).toBeFalsy()
})
test('Can be secured via the environment', () => {
	process.env.ZEEBE_SECURE_CONNECTION = 'false'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.useTLS).toBe(false)
})
test('Can be unsecured via the environment', () => {
	process.env.ZEEBE_SECURE_CONNECTION = 'true'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.useTLS).toBe(true)
})
test('Cert chain path can be configured via the environment', () => {
	process.env.ZEEBE_CLIENT_SSL_CERT_CHAIN_PATH = '/my/path'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.customSSL?.certChain).toBe('file-contents')
})
test('Private key path can be configured via the environment', () => {
	process.env.ZEEBE_CLIENT_SSL_PRIVATE_KEY_PATH = '/my/path'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.customSSL?.privateKey).toBe('file-contents')
})
test('Root certs path can be configured via the environment', () => {
	process.env.ZEEBE_CLIENT_SSL_ROOT_CERTS_PATH = '/my/path'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.customSSL?.rootCerts).toBe('file-contents')
})
test('Retry can be configured via the environment', () => {
	process.env.ZEEBE_CLIENT_RETRY = 'false'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.retry).toBeFalsy()
})
test('Max Retries can be configured via the environment', () => {
	process.env.ZEEBE_CLIENT_MAX_RETRIES = '25'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.maxRetries).toBe(25)
})
test('Max Retries can be set in constructor', () => {
	delete process.env.ZEEBE_CLIENT_MAX_RETRIES
	const conf = ConfigurationHydrator.configure('localhost:26500', {
		maxRetries: 3,
	})
	expect(conf.maxRetries).toBe(3)
})
test('Max Retries in constructor is overridden by environment', () => {
	process.env.ZEEBE_CLIENT_MAX_RETRIES = '20'
	const conf = ConfigurationHydrator.configure('localhost:26500', {
		maxRetries: 3,
	})
	expect(conf.maxRetries).toBe(20)
})
test('Max Retry Timeout can be configured via the environment', () => {
	process.env.ZEEBE_CLIENT_MAX_RETRY_TIMEOUT = '5'
	const conf = ConfigurationHydrator.configure('localhost:26600', {})
	expect(conf.maxRetryTimeout).toBe(5)
})
test('Max Retry Timeout can be set in the constructor', () => {
	delete process.env.ZEEBE_CLIENT_MAX_RETRY_TIMEOUT
	const conf = ConfigurationHydrator.configure('localhost:26600', {
		maxRetryTimeout: 5000,
	})
	expect(conf.maxRetryTimeout).toBe(5000)
})
test('Max Retry Timeout in constructor is overridden by the environment', () => {
	process.env.ZEEBE_CLIENT_MAX_RETRY_TIMEOUT = '5000'
	const conf = ConfigurationHydrator.configure('localhost:26600', {
		maxRetryTimeout: 10000,
	})
	expect(conf.maxRetryTimeout).toBe(5000)
})
test('Tenant ID is picked up from environment', () => {
	process.env.ZEEBE_TENANT_ID = 'someId'
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.tenantId).toBe('someId')
})

test('Tenant ID is picked up from constructor options', () => {
	const conf = ConfigurationHydrator.configure(undefined, {tenantId: 'thisOne'})
	expect(conf.tenantId).toBe('thisOne')
})

test('Tenant ID from constructor overrides environment', () => {
	process.env.ZEEBE_TENANT_ID = 'someId'
	const conf = ConfigurationHydrator.configure(undefined, {tenantId: 'thisOne'})
	expect(conf.tenantId).toBe('thisOne')
})

test('When no Tenant ID is specified in the environment or the constructor, no tenant ID is defined', () => {
	delete process.env.ZEEBE_TENANT_ID
	const conf = ConfigurationHydrator.configure(undefined, undefined)
	expect(conf.tenantId).not.toBeDefined()
})
// const clientId = process.env.ZEEBE_CLIENT_ID
// const clientSecret = process.env.ZEEBE_CLIENT_SECRET
// const audience = process.env.ZEEBE_TOKEN_AUDIENCE
// const authServerUrl = process.env.ZEEBE_AUTHORIZATION_SERVER_URL
// const clusterId = process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
