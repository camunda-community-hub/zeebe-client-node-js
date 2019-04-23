export function stringifyVariables(request: any) {
	const variables = request.variables || {}
	const variablesString = JSON.stringify(variables)
	return (Object as any).assign({}, request, { variables: variablesString })
}
export function parseVariables(response: any) {
	return (Object as any).assign({}, response, {
		variables: JSON.parse(response.variables),
	})
}
