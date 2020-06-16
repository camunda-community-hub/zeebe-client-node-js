import { BpmnParser } from '..'

const testBpmnFile = __dirname + '/testdata/BpmnParser2.bpmn'
const simpleTestBpmnFile = __dirname + '/testdata/BpmnParser.bpmn'
const modeller7File = __dirname + '/testdata/modeller7File.bpmn'

const parsed = BpmnParser.parseBpmn(testBpmnFile)
const parsedSimple = BpmnParser.parseBpmn(simpleTestBpmnFile)

test('parses a bpmn file to an Object', () => {
	expect(typeof parsed).toBe('object')
	expect(typeof parsedSimple).toBe('object')
})

test('can parse a file with a message with no name', async () => {
	const parsedv7 = await BpmnParser.generateConstantsForBpmnFiles(
		modeller7File
	)
	// console.log(parsedv7)
	expect(typeof parsedv7).toBe('string')
})

test('gets a unique list of task types when passed an object', async () => {
	const taskTypes = await BpmnParser.getTaskTypes(parsed)
	expect(taskTypes.length).toBe(2)
})

test('gets a list of unique task types when passed an array', async () => {
	const taskTypes = await BpmnParser.getTaskTypes([parsed, parsedSimple])
	expect(taskTypes.length).toBe(3)
})

test('gets a list of unique message names when passed an object', async () => {
	const messageNames = await BpmnParser.getMessageNames(parsed)
	expect(messageNames.length).toBe(2)
})

test('gets a list of unique message names when passed an array', async () => {
	const messageNames = await BpmnParser.getMessageNames([
		parsed,
		parsedSimple,
	])
	expect(messageNames.length).toBe(3)
})

test('Returns a constants file for a single Bpmn file', async () => {
	const constants = await BpmnParser.generateConstantsForBpmnFiles(
		testBpmnFile
	)
	expect(constants.indexOf('console-log')).not.toBe(-1)
})

test('Returns a constants file for an array of Bpmn files', async () => {
	const constants = await BpmnParser.generateConstantsForBpmnFiles([
		testBpmnFile,
		simpleTestBpmnFile,
	])
	expect(
		constants
			.split(' ')
			.join('')
			.split('\n')
			.join('')
			.indexOf(
				`exportenumMessageName{MSG_EMIT_FRAME="MSG-EMIT_FRAME",MSG_EMIT_FRAME_1="MSG-EMIT_FRAME`
			)
	).not.toBe(-1)
})
