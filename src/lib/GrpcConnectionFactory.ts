import { GrpcClientCtor } from './GrpcClient'
import { GrpcConnectionProfile, GrpcMiddleware } from './GrpcMiddleware'

export class GrpcConnectionFactory {
	public static getGrpcClient(config: GrpcClientCtor) {
		const profile = GrpcConnectionFactory.autodetect(config)
		return new GrpcMiddleware({ profile, config }).getGrpcClient()
	}
	private static autodetect(config: GrpcClientCtor): GrpcConnectionProfile {
		const isCamundaCloud = config.host.includes('zeebe.camunda.io')
		return isCamundaCloud ? 'CAMUNDA_CLOUD' : 'VANILLA'
	}
}
