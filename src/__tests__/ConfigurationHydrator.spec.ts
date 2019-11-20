import { ConfigurationHydrator } from '../lib/ConfigurationHydrator'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'
// const gatewayAddress = process.env.ZEEBE_GATEWAY_ADDRESS || '0.0.0.0:26500'

describe('ConfigurationHydrator', () => {
	const STORED_ENV = {}
	const ENV_VARS_TO_STORE = [
		'ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID',
		'ZEEBE_CLIENT_SECRET',
		'ZEEBE_CLIENT_ID',
		'ZEEBE_GATEWAY_ADDRESS',
		'ZEEBE_ADDRESS',
		'ZEEBE_TOKEN_AUDIENCE',
		'ZEEBE_AUTHORIZATION_SERVER_URL',
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
	it('Has a zero-conf for localhost:26500', () => {
		delete process.env.ZEEBE_GATEWAY_ADDRESS
		const conf = ConfigurationHydrator.configure(undefined, undefined)
		expect(conf.hostname).toBe('localhost')
		expect(conf.port).toBe('26500')
	})
	it('Has a zero-conf that uses ZEEBE_GATEWAY_ADDRESS from the env with zeebe:// protocol', () => {
		process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://my-server:26600'
		const conf = ConfigurationHydrator.configure(undefined, undefined)
		expect(conf.hostname).toBe('my-server')
		expect(conf.port).toBe('26600')
	})
	it('Has a zero-conf that uses ZEEBE_GATEWAY_ADDRESS from the env without zeebe:// protocol', () => {
		process.env.ZEEBE_GATEWAY_ADDRESS = 'my-server:26600'
		const conf = ConfigurationHydrator.configure(undefined, undefined)
		expect(conf.hostname).toBe('my-server')
		expect(conf.port).toBe('26600')
	})
	it('Decodes a zeebe://hostname with default port', () => {
		delete process.env.ZEEBE_GATEWAY_ADDRESS
		const conf = ConfigurationHydrator.configure(
			'zeebe://zeebe.io',
			undefined
		)
		expect(conf.hostname).toBe('zeebe.io')
		expect(conf.port).toBe('26500')
	})
	it('Decodes a zeebe://hostname:port', () => {
		delete process.env.ZEEBE_GATEWAY_ADDRESS
		const conf = ConfigurationHydrator.configure(
			'zeebe://zeebe.io:26600',
			undefined
		)
		expect(conf.hostname).toBe('zeebe.io')
		expect(conf.port).toBe('26600')
	})
	it('Decodes a zeebe://hostname:port', () => {
		delete process.env.ZEEBE_GATEWAY_ADDRESS
		const conf = ConfigurationHydrator.configure(
			'zeebe://zeebe.io:26600',
			undefined
		)
		expect(conf.hostname).toBe('zeebe.io')
		expect(conf.port).toBe('26600')
	})
	it('Decodes a hostname:port', () => {
		delete process.env.ZEEBE_GATEWAY_ADDRESS
		const conf = ConfigurationHydrator.configure(
			'zeebe.io:26600',
			undefined
		)
		expect(conf.hostname).toBe('zeebe.io')
		expect(conf.port).toBe('26600')
	})
	it('Takes an explicit Gateway address over the environment ZEEBE_GATEWAY_ADDRESS', () => {
		process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
		const conf = ConfigurationHydrator.configure(
			'zeebe://zeebe.io:26600',
			undefined
		)
		expect(conf.hostname).toBe('zeebe.io')
		expect(conf.port).toBe('26600')
	})
	it('Constructs the Camunda Cloud connection from the environment with just three parameters', () => {
		process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID =
			'103ca930-6da6-4df7-aa97-941eb1f85040'
		process.env.ZEEBE_CLIENT_SECRET =
			'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
		process.env.ZEEBE_CLIENT_ID = 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh'
		delete process.env.ZEEBE_GATEWAY_ADDRESS
		// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
		const conf = ConfigurationHydrator.configure(undefined, undefined)
		expect(conf.hostname).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.port).toBe('443')
		expect(conf.oAuth!.audience).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.oAuth!.url).toBe(
			'https://login.cloud.camunda.io/oauth/token'
		)
		expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
		expect(conf.oAuth!.clientSecret).toBe(
			'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
		)
	})
	it('Constructs the Camunda Cloud connection from a CamundaCloudConfig with just three parameters', () => {
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
		expect(conf.hostname).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.port).toBe('443')
		expect(conf.oAuth!.audience).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.oAuth!.url).toBe(
			'https://login.cloud.camunda.io/oauth/token'
		)
		expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
		expect(conf.oAuth!.clientSecret).toBe(
			'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
		)
	})
	it('Constructs the Camunda Cloud connection correctly when the user pastes in the entire connection string (works for Daniel in demos)', () => {
		// process.env.ZEEBE_GATEWAY_ADDRESS = 'zeebe://localhost:26500'
		const conf = ConfigurationHydrator.configure(undefined, {
			camundaCloud: {
				clientId: 'yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh',
				clientSecret:
					'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_',
				clusterId:
					'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io:443',
			},
		})
		expect(conf.hostname).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.port).toBe('443')
		expect(conf.oAuth!.audience).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.oAuth!.url).toBe(
			'https://login.cloud.camunda.io/oauth/token'
		)
		expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
		expect(conf.oAuth!.clientSecret).toBe(
			'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
		)
	})
	it('Caches the JWT from Camunda Cloud by default', () => {
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
	it('Does not cache the JWT from Camunda Cloud if specified', () => {
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
	it('Takes a CamundaCloudConfig over the environment', () => {
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
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.port).toBe('443')
		expect(conf.oAuth!.audience).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.oAuth!.url).toBe(
			'https://login.cloud.camunda.io/oauth/token'
		)
		expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
		expect(conf.oAuth!.clientSecret).toBe(
			'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
		)
	})
	it('Uses an explicit gateway over the environment Camunda Cloud config', () => {
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
	it('Uses the Camunda Cloud connection from a CamundaCloudConfig, overriding the explicit gateway', () => {
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
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.port).toBe('443')
		expect(conf.oAuth!.audience).toBe(
			'103ca930-6da6-4df7-aa97-941eb1f85040.zeebe.camunda.io'
		)
		expect(conf.oAuth!.url).toBe(
			'https://login.cloud.camunda.io/oauth/token'
		)
		expect(conf.oAuth!.clientId).toBe('yStuGvJ6a1RQhy8DQpeXJ80yEpar3pXh')
		expect(conf.oAuth!.clientSecret).toBe(
			'WZahIGHjyj0-oQ7DZ_aH2wwNuZt5O8Sq0ZJTz0OaxfO7D6jaDBZxM_Q-BHRsiGO_'
		)
	})
	it('Is insecure by default', () => {
		delete process.env.ZEEBE_INSECURE_CONNECTION
		const conf = ConfigurationHydrator.configure('localhost:26600', {})
		expect(conf.useTLS).toBeFalsy()
	})
	it('Can be secured via the environment', () => {
		process.env.ZEEBE_INSECURE_CONNECTION = 'false'
		const conf = ConfigurationHydrator.configure('localhost:26600', {})
		expect(conf.useTLS).toBe(true)
	})
	it('Can be unsecured via the environment', () => {
		process.env.ZEEBE_INSECURE_CONNECTION = 'true'
		const conf = ConfigurationHydrator.configure('localhost:26600', {})
		expect(conf.useTLS).toBe(false)
	})
	// const clientId = process.env.ZEEBE_CLIENT_ID
	// const clientSecret = process.env.ZEEBE_CLIENT_SECRET
	// const audience = process.env.ZEEBE_TOKEN_AUDIENCE
	// const authServerUrl = process.env.ZEEBE_AUTHORIZATION_SERVER_URL
	// const clusterId = process.env.ZEEBE_CAMUNDA_CLOUD_CLUSTER_ID
})
