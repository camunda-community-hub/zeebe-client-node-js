import { MaybeTimeDuration } from 'typed-duration'
import { CustomSSL } from './GrpcClient'
import { OAuthProviderConfig } from './OAuthProvider'

export interface CamundaCloudConfig {
	clusterId: string
	/**
	 * Defaults to `bru-2`
	 */
	clusterRegion?: string
	/**
	 * Just the UUID of the cluster
	 */
	clientId: string
	clientSecret: string
	cacheDir?: string
	cacheOnDisk?: boolean
}

export type Loglevel = 'INFO' | 'DEBUG' | 'NONE' | 'ERROR'

export interface ZBCustomLogger {
	/**
	 * Receives a JSON-stringified ZBLogMessage
	 */
	debug: (message: string) => void
	/**
	 * Receives a JSON-stringified ZBLogMessage
	 */
	info: (message: string) => void
	/**
	 * Receives a JSON-stringified ZBLogMessage
	 */
	error: (message: string) => void
}

export interface ZBClientOptions {
	connectionTolerance?: MaybeTimeDuration
	eagerConnection?: boolean
	loglevel?: Loglevel
	stdout?: ZBCustomLogger
	retry?: boolean
	maxRetries?: number
	maxRetryTimeout?: MaybeTimeDuration
	oAuth?: OAuthProviderConfig
	basicAuth?: {
		username: string
		password: string
	}
	useTLS?: boolean
	logNamespace?: string
	longPoll?: MaybeTimeDuration
	pollInterval?: MaybeTimeDuration
	camundaCloud?: CamundaCloudConfig
	hostname?: string
	port?: string
	onReady?: () => void
	onConnectionError?: () => void
	customSSL?: CustomSSL
	tenantId?: string
}
