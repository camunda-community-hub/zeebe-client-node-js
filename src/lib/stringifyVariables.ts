import { Job } from './interfaces'
import { ActivatedJob } from './interfaces-grpc'

export function stringifyVariables<
	T extends { variables: { [key: string]: any } }
>(request: T): T {
	const variables = request.variables || {}
	const variablesString = JSON.stringify(variables)
	return (Object as any).assign({}, request, { variables: variablesString })
}
type JSON = string | number | boolean | JSON[] | JSONDoc[]
interface JSONDoc {
	[key: string]: JSON
}

export function parseVariablesAndCustomHeadersToJSON<Variables, CustomHeaders>(
	response: ActivatedJob
): Job<Variables, CustomHeaders> {
	return (Object as any).assign({}, response, {
		customHeaders: JSON.parse(response.customHeaders),
		variables: JSON.parse(response.variables),
	}) as Job<Variables, CustomHeaders>
}

export function parseVariables<T extends { variables: string }>(
	response: T
): T & { variables: JSONDoc } {
	return (Object as any).assign({}, response, {
		variables: JSON.parse(response.variables || '{}'),
	})
}
