export function stringifyPayload(request: any) {
	const payload = request.payload || {}
	const payloadString = JSON.stringify(payload)
	return (Object as any).assign({}, request, { payload: payloadString })
}
export function parsePayload(response: any) {
	return (Object as any).assign({}, response, {
		payload: JSON.parse(response.payload),
	})
}
