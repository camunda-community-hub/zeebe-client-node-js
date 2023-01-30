import { ZBClient } from "../../index";

test('Modify Process Instance', () =>{
	const zbc = new ZBClient()
	zbc.modifyProcessInstance({
		processInstanceKey: '',
		activateInstructions: [{
			elementId: 'second_service_task',
			ancestorElementInstanceKey: "-1",
			variableInstructions: [{
				scopeId: '',
				variables: {a: 3}
			}]
		}]
	})
})

