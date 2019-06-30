export class Utils {
	/**
	 * Throw an Error if the variable passed is not a number
	 */
	public static validateNumber(
		variable: string | number,
		field: string
	): void {
		const value = Number(variable)
		if (!Number.isInteger(value)) {
			throw new Error(`
		  ${field} is malformed, value : ${variable}
		  `)
		}
	}
}
