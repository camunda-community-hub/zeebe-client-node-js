import { either as E } from 'fp-ts'
import * as fs from 'fs'
import * as path from 'path'
import { WorkflowRequestObject } from '../interfaces-grpc'

export const readDefinitionFromFile = (
	file: string
): E.Either<string, WorkflowRequestObject> =>
	fs.existsSync(file)
		? E.right({
				definition: fs.readFileSync(file),
				name: path.basename(file),
				type: 1,
		  })
		: E.left(file)
