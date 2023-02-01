import { Job } from './interfaces-1.0'
import { ActivatedJob } from './interfaces-grpc-1.0'

export function parseVariables<T extends { variables: string }>(
	response: T
): T & { variables: JSONDoc } {
	return (Object as any).assign({}, response, {
		variables: JSON.parse(response.variables || '{}'),
	})
}

export function parseVariablesAndCustomHeadersToJSON<Variables, CustomHeaders>(
	response: ActivatedJob
): Job<Variables, CustomHeaders> {
	return (Object as any).assign({}, response, {
		customHeaders: JSON.parse(response.customHeaders),
		variables: JSON.parse(response.variables),
	}) as Job<Variables, CustomHeaders>
}

export function stringifyVariables<
	K, T extends { variables: K extends { [key: string]: any } ? K : K }, V extends T & {variables: string}
>(request: T): V {
	const variables = request.variables || {}
	const variablesString = JSON.stringify(variables)
	return (Object as any).assign({}, request, { variables: variablesString })
}

type JSON = string | number | boolean | JSON[] | JSONDoc[]
interface JSONDoc {
	[key: string]: JSON
}
