import { MaybeTimeDuration } from 'typed-duration'
import { OAuthProviderConfig } from './OAuthProvider'

export interface CamundaCloudConfig {
	clusterId: string
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
	maxRetryTimeout?: number
	oAuth?: OAuthProviderConfig
	basicAuth?: {
		username: string
		password: string
	}
	useTLS?: boolean
	logNamespace?: string
	longPoll?: MaybeTimeDuration
	camundaCloud?: CamundaCloudConfig
	hostname?: string
	port?: string
	onReady?: () => void
	onConnectionError?: () => void
}
