import { ZBClient } from '../../index'

process.env.ZEEBE_NODE_LOG_LEVEL = process.env.ZEEBE_NODE_LOG_LEVEL || 'NONE'

test("EvaluateDecision", async () => {
	const zbc = new ZBClient()
	const res = await zbc.deployResource({
		decisionFilename: `./src/__tests__/testdata/decision.dmn`
	})

	const dmnDecisionName = "My Decision"
	expect(res.deployments[0].decision.dmnDecisionName).toBe(dmnDecisionName)

	const dmnDecisionId = "Decision_13dmfgp"
	const r = await zbc.evaluateDecision({
		decisionId: dmnDecisionId,
		variables: {season: "fall"}
	})
	expect(r.evaluatedDecisions.length).toBe(1)

	await zbc.close()
})
/**
    {
      "evaluatedDecisions": [
        {
          "matchedRules": [],
          "evaluatedInputs": [
            {
              "inputId": "Input_1",
              "inputName": "season",
              "inputValue": "\"fall\""
            }
          ],
          "decisionKey": "2251799813848760",
          "decisionId": "Decision_13dmfgp",
          "decisionName": "My Decision",
          "decisionVersion": 1,
          "decisionType": "DECISION_TABLE",
          "decisionOutput": "null"
        }
      ],
      "decisionKey": "2251799813848760",
      "decisionId": "Decision_13dmfgp",
      "decisionName": "My Decision",
      "decisionVersion": 1,
      "decisionRequirementsId": "Definitions_1j6sjj9",
      "decisionRequirementsKey": "2251799813848759",
      "decisionOutput": "null",
      "failedDecisionId": "",
      "failureMessage": ""
    }
 */
