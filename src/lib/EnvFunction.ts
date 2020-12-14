type EnvFunction = <T extends Readonly<K[]>, K extends string>(
	keys: T
) => {
	[key1 in T[number]]: string
}

export const getEnv: EnvFunction = keys => {
	return keys.reduce(
		(prev, current) => ({
			...prev,
			[current]: process.env[current],
		}),
		{} as any
	)
}
