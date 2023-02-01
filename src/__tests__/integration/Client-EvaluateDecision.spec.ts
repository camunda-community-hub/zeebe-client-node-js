import { ZBClient } from '../../index'

test("EvaluateDecision", async () => {
	const zbc = new ZBClient()
	const res = await zbc.deployResource({
		decisionFilename: `./src/__tests__/testdata/decision.dmn`
	})
	// console.log(JSON.stringify(res, null, 2))

	const dmnDecisionName = "My Decision"
	expect(res.deployments[0].decision.dmnDecisionName).toBe(dmnDecisionName)

	// NOT IMPLEMENTED YET
	// const dmnDecisionId = "Decision_13dmfgp"
	// const r = await zbc.evaluateDecision({
	// 	decisionId: dmnDecisionId,
	// 	variables: {season: "fall"}
	// })
	// console.log(JSON.stringify(r, null, 2))
	// expect(r).toBeTruthy()
})
