import { makeAPI1ResAPI0Compatible, transformAPI0ReqToAPI1 } from '../../lib'

test('it can transform a flat object response', () => {
	const API1Req = {
		processKey: '2251799813685500',
		bpmnProcessId: 'process-84b7c2df-9c8a-4eca-b21c-b34f43e0c5d9',
		version: 1,
		processInstanceKey: '2251799813685502',
	}
	const API0Req = {
		workflowKey: '2251799813685500',
		bpmnProcessId: 'process-84b7c2df-9c8a-4eca-b21c-b34f43e0c5d9',
		version: 1,
		workflowInstanceKey: '2251799813685502',
	}
	const API0Res = {
		workflowKey: '2251799813685500',
		bpmnProcessId: 'process-84b7c2df-9c8a-4eca-b21c-b34f43e0c5d9',
		version: 1,
		workflowInstanceKey: '2251799813685502',
		processKey: '2251799813685500',
		processInstanceKey: '2251799813685502',
	}
	expect(transformAPI0ReqToAPI1(API0Req)).toMatchObject(API1Req)
	expect(makeAPI1ResAPI0Compatible(API1Req)).toMatchObject(API0Res)
})

test('it can transform a nested array response', () => {
	const API1Res = {
		processes: [
			{
				bpmnProcessId: 'process-885a6e39-4881-4e1f-9261-636b5aa7f8df',
				version: 1,
				processKey: '2251799813687856',
				resourceName:
					'conditional-pathway-process-885a6e39-4881-4e1f-9261-636b5aa7f8df.bpmn',
			},
		],
		key: '2251799813687856',
	}
	const API0CompatRes = {
		processes: [
			{
				bpmnProcessId: 'process-885a6e39-4881-4e1f-9261-636b5aa7f8df',
				version: 1,
				processKey: '2251799813687856',
				resourceName:
					'conditional-pathway-process-885a6e39-4881-4e1f-9261-636b5aa7f8df.bpmn',
			},
		],
		workflows: [
			{
				bpmnProcessId: 'process-885a6e39-4881-4e1f-9261-636b5aa7f8df',
				version: 1,
				workflowKey: '2251799813687856',
				processKey: '2251799813687856',
				resourceName:
					'conditional-pathway-process-885a6e39-4881-4e1f-9261-636b5aa7f8df.bpmn',
			},
		],
		key: '2251799813687856',
	}
	expect(makeAPI1ResAPI0Compatible(API1Res)).toMatchObject(API0CompatRes)
})
