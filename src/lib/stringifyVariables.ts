export function stringifyVariables<
	T extends { variables: { [key: string]: any } }
>(request: T) {
	const variables = request.variables || {}
	const variablesString = JSON.stringify(variables)
	return (Object as any).assign({}, request, { variables: variablesString })
}
export function parseVariables<T extends { variables: string }>(response: T) {
	return (Object as any).assign({}, response, {
		variables: JSON.parse(response.variables),
	})
}
