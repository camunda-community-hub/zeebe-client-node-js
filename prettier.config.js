module.exports = {
	endOfLine: "lf",
	useTabs: true,
	tabWidth: 4,

	trailingComma: "es5",
	semi: false,
	singleQuote: true,
	jsxSingleQuote: true,
	overrides: [
		{
			files: ["*.yaml", "*.yml"],
			options: {
				useTabs: false,
				tabWidth: 2,
				singleQuote: false
			}
		}
	]
};
