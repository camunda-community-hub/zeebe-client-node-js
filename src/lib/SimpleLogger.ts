import dayjs from 'dayjs'
import { Loglevel } from './interfaces-published-contract'

export interface Logger {
	error: LogFn
	info: LogFn
	debug: LogFn
}
type LogFn = (logMessage: string) => void

/**
 * Simple logger for ZBClient
 */
const logger = (loglevel: Loglevel): LogFn => (logMessage: string): void => {
	let message: string
	try {
		const parsedMessage = JSON.parse(logMessage)
		const gRPC =
			parsedMessage.id === 'gRPC Channel' ? ' [gRPC Channel]:' : ''
		const taskType = parsedMessage.taskType
			? ` [${parsedMessage.taskType}]`
			: ''
		const msg =
			typeof parsedMessage.message === 'object'
				? JSON.stringify(parsedMessage.message)
				: parsedMessage.message
		message = `| zeebe | ${gRPC}${taskType} ${loglevel}: ${msg}`
	} catch (e) {
		message = logMessage
	}
	const time = dayjs().format('HH:mm:ss.SSS')
	// tslint:disable-next-line: no-console
	const logMethod = loglevel === 'INFO' ? console.info : console.error
	logMethod(`${time} ${message}`)
}

export const ZBSimpleLogger: Logger = {
	debug: logger('DEBUG'),
	error: logger('ERROR'),
	info: logger('INFO'),
}
