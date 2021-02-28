type JSON = string | number | boolean | JSON[] | JSONDoc[]
interface JSONDoc {
	[key: string]: JSON
}

// @TODO: fix spelling
const ZeroToOneMapping: Array<[from: string, to: string]> = [
	['workflows', 'processs'],
	['workflow', 'process'],
	['Workflows', 'Processs'],
	['Workflow', 'Process']
]

const OneToZeroMapping: Array<[from: string, to: string]> = [
	['processes', 'workflows'],
	['Processes', 'Workflows'],
	['process', 'workflow'],
	['Process', 'Workflow'],
]

const NormaliseOneMapping: Array<[from: string, to: string]> = [
	['processs', 'processes'],
	['Processs', 'processes']
]

const IgnoreDuringTransform = ['bpmnProcessId']

export function makeAPI1ResAPI0Compatible(api1Res: any) {
	const extend = (key: string, value: any) =>
		OneToZeroMapping.reduce<{[x:string]: any} | undefined>(
			(curr, m) =>  curr === undefined && key.includes(m[0]) && !IgnoreDuringTransform.includes(key) ?
				{[key.replace(m[0], m[1])]: value, [key]: value} :
				curr
			, undefined) ?? {[key]: value}

	return typeof api1Res === 'object'
		? Object.keys(api1Res).reduce(
				(acc, key) => {
					if (!Array.isArray(api1Res[key])) {
						return { ...acc, ...extend(key, api1Res[key]) }
					} else {
						// recursively transform
						const api0Key = Object.keys(extend(key, api1Res[key]))[0]
						return { ...acc, [key]: api1Res[key], [api0Key]: api1Res[key].map(makeAPI1ResAPI0Compatible)}
					}
				}, {}
		  )
		: api1Res
}

export function transformAPI0ReqToAPI1(api0Object: any) {
	const replace = (key: string) =>
		ZeroToOneMapping.reduce<string | undefined>((curr, m) =>
			curr === undefined && key.includes(m[0]) && !IgnoreDuringTransform.includes(key) ?
				key.replace(m[0], m[1]) :
				curr, undefined) ?? key
	return typeof api0Object === 'object'
		? Object.keys(api0Object).reduce(
				(acc, key) => {
					if (!Array.isArray(api0Object[key])) {
						return { ...acc, [replace(key)]: api0Object[key] }
					} else {
						// recursively transform
						const newKey = replace(key)
						return { ...acc, [newKey]: api0Object[key].map(transformAPI0ReqToAPI1)}
					}
				},
				{}
		  )
		: api0Object
}

// Deals with the misspelling of 'processes' in the gRPC API
export function normaliseAPI1(thing: any) {
	const replace = key => NormaliseOneMapping.reduce((curr, m) =>
		key.includes(m[0]) ?
			key.replace(m[0], m[1]):
			curr, key)
	return typeof thing === 'object'
		? Object.keys(thing).reduce(
				(acc, key) => ({ ...acc, [replace(key)]: thing[key] }),
				{}
		  )
		: thing
}
