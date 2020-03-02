import * as ZB from './interfaces'

function isConfig(config: any): config is ZB.ZBWorkerConfig<any, any, any> {
	return typeof config === 'object'
}

const cleanEmpty = obj =>
	Object.entries(obj)
		.map(([k, v]) => [k, v && typeof v === 'object' ? cleanEmpty(v) : v])
		.reduce((a, [k, v]) => (v == null ? a : { ...a, [k]: v }), {})

export function decodeCreateZBWorkerSig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
>(config) {
	const coerceConf = config.idOrTaskTypeOrConfig
	const conf = isConfig(coerceConf) ? coerceConf : undefined
	if (conf) {
		return cleanEmpty({
			id: conf.id,
			onConnectionError: conf.onConnectionError,
			onReady: conf.onReady,
			options: {
				logNamespace: config.logNamespace,
				loglevel: config.loglevel,
				longPoll: config.longPoll,
				stdout: config.stdout,
			},
			taskHandler: conf.taskHandler,
			taskType: conf.taskType,
		})
	}
	const isShorthandSig = typeof config.taskTypeOrTaskHandler === 'function'
	const taskHandler: ZB.ZBWorkerTaskHandler<
		WorkerInputVariables,
		CustomHeaderShape,
		WorkerOutputVariables
	> = isShorthandSig
		? (config.taskTypeOrTaskHandler as ZB.ZBWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
		  >)
		: (config.taskHandlerOrOptions as ZB.ZBWorkerTaskHandler<
				WorkerInputVariables,
				CustomHeaderShape,
				WorkerOutputVariables
		  >)
	const id: string | null = isShorthandSig
		? (config.idOrTaskTypeOrConfig as string)
		: null
	const taskType: string = isShorthandSig
		? (config.idOrTaskTypeOrConfig as string)
		: (config.taskTypeOrTaskHandler as string)
	const options: ZB.ZBWorkerOptions & ZB.ZBClientOptions =
		(isShorthandSig
			? config.taskHandlerOrOptions
			: config.optionsOrOnConnectionError) || {}
	const onConnectionError = isShorthandSig
		? config.optionsOrOnConnectionError
		: config.onConnectionError ||
		  options.onConnectionError ||
		  config.onConnectionError
	const onReady = options.onReady
	return cleanEmpty({
		id,
		onConnectionError,
		onReady,
		options,
		taskHandler,
		taskType,
	})
}
