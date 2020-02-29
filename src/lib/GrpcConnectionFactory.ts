import { GrpcClientCtor } from './GRPCClient'
import { GrpcMiddleware, GrpcConnectionProfile } from './GrpcMiddleware'

export class GrpcConnectionFactory {
	private static autodetect(config: GrpcClientCtor): GrpcConnectionProfile {
		const isCamundaCloud = config.host.includes('zeebe.camunda.io')
		return isCamundaCloud ? 'CAMUNDA_CLOUD' : 'VANILLA'
	}
	public static getGrpcClient(config: GrpcClientCtor) {
		const profile = GrpcConnectionFactory.autodetect(config)
		return new GrpcMiddleware({ profile, config }).getGrpcClient()
	}
}
