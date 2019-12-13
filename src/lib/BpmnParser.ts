import parser = require('fast-xml-parser')
import fs = require('fs')
import * as path from 'path'

// Converts, for example, task_type or task-type to TaskType
const getSafeName = tasktype =>
	tasktype
		.split('_')
		.map(([f, ...r]) => [f.toUpperCase(), ...r].join(''))
		.join('')
		.split('-')
		.map(([f, ...r]) => [f.toUpperCase(), ...r].join(''))
		.join('')

const getConstantName = name =>
	name
		.split('-')
		.join('_')
		.split(' ')
		.join('_')
		.toUpperCase()

const toArray = stringOrArray =>
	Array.isArray(stringOrArray) ? stringOrArray : [stringOrArray]

export class BpmnParser {
	public static taskTypes

	/**
	 * Read BPMN files and return an array of one or more parsed BPMN objects.
	 * @param filenames - A single BPMN file path, or array of BPMN file paths.
	 */
	public static parseBpmn(filenames: string | string[]): object {
		if (typeof filenames === 'string') {
			filenames = [filenames]
		}
		return filenames.map(filename => {
			const xmlData = fs.readFileSync(filename).toString()
			if (parser.validate(xmlData)) {
				return parser.parse(xmlData, BpmnParser.parserOptions)
			}
			return {}
		})
	}

	// @ TODO: examine Camunda's parse BPMN code
	// https://github.com/camunda/camunda-bpmn-model/tree/master/src/main/java/org/camunda/bpm/model/bpmn
	public static getProcessId(bpmnString: string) {
		const jsonObj = parser.parse(bpmnString, BpmnParser.parserOptions)
		return jsonObj?.['bpmn:definitions']?.['bpmn:process']?.attr?.['@_id']
	}

	// Produce a starter worker file from a BPMN file
	public static async scaffold(filename: string) {
		const removeUndefined = t => !!t

		const buildEnumDictionaryFromArray = (a: string[]) =>
			a
				.filter(removeUndefined)
				.map(t => ({ [t]: getConstantName(t) }))
				.reduce((prev, curr) => ({ ...prev, ...curr }), {})

		const bpmnObject = BpmnParser.parseBpmn(filename)[0]

		const taskTypes = await BpmnParser.getTaskTypes(bpmnObject)
		const taskEnumDict = buildEnumDictionaryFromArray(taskTypes)
		// tslint:disable-next-line: no-console
		console.log(taskEnumDict) // @DEBUG

		const interfaces = await BpmnParser.generateConstantsForBpmnFiles(
			filename
		)

		const headerInterfaces: { [key: string]: string[] } = {} // mutated in the recursive function

		await scanForHeadersRecursively(bpmnObject)

		const importStmnt = `import { ZBClient } from "zeebe-node"

const zbc = new ZBClient()
`
		const genericWorkflowVariables = `// @TODO Update with the shape of your job variables
// For better intellisense and type-safety
export interface WorkflowVariables {
	[key: string]: any
}`

		const workers = taskTypes
			.map(
				t => `// Worker for tasks of type "${t}"
${
	headerInterfaces[t]
		? headerInterfaces[t].join('|')
		: 'type ' + getSafeName(t) + 'CustomHeaders = never'
}

export const ${getSafeName(t)}Worker = zbc.createWorker<
WorkflowVariables,
${getSafeName(t)}CustomHeaders,
WorkflowVariables
>(null, TaskType.${taskEnumDict[t]}, (job, complete, worker) => {
	worker.log(job)
	complete.success()
})
`
			)
			.join('\n')

		return `${importStmnt}
${genericWorkflowVariables}
${interfaces}
${workers}`

		async function scanForHeadersRecursively(obj: object) {
			if (!(obj instanceof Object)) {
				return
			}
			for (const k in obj) {
				if (obj.hasOwnProperty(k)) {
					if (k === 'bpmn:serviceTask') {
						const tasks = toArray(obj[k])
						tasks.forEach(t => {
							const taskHeaders =
								t['bpmn:extensionElements']['zeebe:taskHeaders']
							const customHeaderNames = taskHeaders
								? toArray(taskHeaders['zeebe:header']).map(
										h => h.attr['@_key']
								  )
								: undefined

							const tasktype =
								t['bpmn:extensionElements'][
									'zeebe:taskDefinition'
								].attr['@_type']
							const headerInterfaceName = getSafeName(tasktype)
							if (customHeaderNames) {
								const headerInterfaceDfnBody = customHeaderNames
									.sort()
									.map(h => '    ' + h + ': string')
									.join('\n')
								const headerInterfaceDfn = `interface ${headerInterfaceName}CustomHeaders {
${headerInterfaceDfnBody}
}`
								if (!headerInterfaces[tasktype]) {
									headerInterfaces[tasktype] = [
										headerInterfaceDfn,
									]
								} else {
									if (
										headerInterfaces[tasktype].filter(
											d => d === headerInterfaceDfn
										).length === 0
									) {
										headerInterfaces[tasktype].push(
											`{
${headerInterfaceDfnBody}
}`
										)
									}
								}
							}
						})
					} else {
						// recursive call to scan property
						await scanForHeadersRecursively(obj[k])
					}
				}
			}
		}
	}

	/**
	 * Generate TypeScript constants for task types and message names in BPMN files
	 * @param filenames - a BPMN file path or array of BPMN file paths
	 */
	public static async generateConstantsForBpmnFiles(
		filenames: string | string[]
	): Promise<string> {
		const removeUndefined = t => !!t

		const buildEnumListFromArray = a =>
			a
				.filter(removeUndefined)
				.map(t => `    ${getConstantName(t)} = "${t}"`)
				.join(',\n')

		if (typeof filenames === 'string') {
			filenames = [filenames]
		}

		const parsed = BpmnParser.parseBpmn(filenames)
		const taskTypes = await BpmnParser.getTaskTypes(parsed)
		const messageNames = await BpmnParser.getMessageNames(parsed)
		const files = filenames.map(f => path.basename(f))
		const taskEnumMembers = buildEnumListFromArray(taskTypes)
		const messageEnumMembers = buildEnumListFromArray(messageNames)

		return `
// Autogenerated constants for ${files}

export enum TaskType {
${taskEnumMembers}
}

export enum MessageName {
${messageEnumMembers}
}

`
	}

	/**
	 * Take one or more parsed BPMN objects and return an array of unique task types.
	 * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
	 */
	public static async getTaskTypes(
		processes: object[] | object
	): Promise<string[]> {
		const processArray = toArray(processes)
		return BpmnParser.mergeDedupeAndSort(
			await Promise.all(
				processArray.map(BpmnParser.scanBpmnObjectForTasks)
			)
		)
	}

	/**
	 * Take one or more parsed BPMN objects and return an array of unique message names.
	 * @param processes - A parsed BPMN object, or an array of parsed BPMN objects.
	 */
	public static async getMessageNames(
		processes: object[] | object
	): Promise<string[]> {
		const processArray = toArray(processes)

		return BpmnParser.mergeDedupeAndSort(
			await Promise.all(
				processArray.map(BpmnParser.scanBpmnObjectForMessages)
			)
		)
	}

	private static parserOptions = {
		allowBooleanAttributes: false,
		attrNodeName: 'attr',
		attributeNamePrefix: '@_',
		cdataPositionChar: '\\c',
		cdataTagName: '__cdata',
		ignoreAttributes: false,
		ignoreNameSpace: false,
		localeRange: '',
		parseAttributeValue: false,
		parseNodeValue: true,
		parseTrueNumberOnly: false,
		textNodeName: '#text',
		trimValues: true,
	}

	private static mergeDedupeAndSort(arr) {
		return [...new Set([].concat(...arr).sort())]
	}

	/**
	 * Return an array of task types.
	 * @param bpmnObject - A parsed Bpmn object.
	 */
	private static async scanBpmnObjectForTasks(bpmnObject: object) {
		let taskTypes: string[] = [] // mutated in the recursive function

		await scanRecursively(bpmnObject)
		return [...new Set(taskTypes.sort())]

		async function scanRecursively(obj: object) {
			let k: any
			if (!(obj instanceof Object)) {
				return // not an Object so obj[k] here is a value
			}
			for (k in obj) {
				if (obj.hasOwnProperty(k)) {
					if (k === 'bpmn:serviceTask') {
						const tasks = toArray(obj[k])
						taskTypes = taskTypes.concat(
							tasks.map(
								t =>
									t['bpmn:extensionElements'][
										'zeebe:taskDefinition'
									].attr['@_type']
							)
						)
					} else {
						// recursive call to scan property
						await scanRecursively(obj[k])
					}
				}
			}
		}
	}
	/**
	 * Return an array of message names.
	 * @param bpmnObject - A parsed Bpmn object.
	 */
	private static async scanBpmnObjectForMessages(bpmnObject: object) {
		let messageNames: string[] = [] // mutated in the recursive function

		await scanRecursively(bpmnObject)
		return [...new Set(messageNames.sort())]

		async function scanRecursively(obj: object) {
			let k: any
			if (!(obj instanceof Object)) {
				return // not an Object so obj[k] here is a value
			}
			for (k in obj) {
				if (obj.hasOwnProperty(k)) {
					if (k === 'bpmn:message') {
						const messages = toArray(obj[k])

						messageNames = messageNames.concat(
							messages.map(m => m.attr['@_name'])
						)
					} else {
						// recursive call to scan property
						await scanRecursively(obj[k])
					}
				}
			}
		}
	}
}
