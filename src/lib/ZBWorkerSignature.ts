import * as ZB from './interfaces'

export function decodeCreateZBWorkerSig<
	WorkerInputVariables,
	CustomHeaderShape,
	WorkerOutputVariables
>(config) {
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
		? (config.idOrTaskType as string)
		: null
	const taskType: string = isShorthandSig
		? (config.idOrTaskType as string)
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
	return {
		id,
		onConnectionError,
		onReady,
		options,
		taskHandler,
		taskType,
	}
}
