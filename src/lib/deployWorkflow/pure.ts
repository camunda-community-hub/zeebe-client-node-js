import { either as E, pipeable } from 'fp-ts'
import * as A from 'fp-ts/lib/Array'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as ZB from '../interfaces'

export const isBuffer = (
	wf: ZB.DeployWorkflowBuffer | ZB.DeployWorkflowFiles
): wf is ZB.DeployWorkflowBuffer => !!(wf as ZB.DeployWorkflowBuffer).definition

export const bufferOrFiles = (
	wf: ZB.DeployWorkflowFiles | ZB.DeployWorkflowBuffer
): E.Either<ZB.DeployWorkflowBuffer[], string[]> =>
	isBuffer(wf) ? E.left([wf]) : E.right(coerceFilenamesToArray(wf))

export const coerceFilenamesToArray = (wf: string | string[]): string[] =>
	Array.isArray(wf) ? wf : [wf]

export const mapThese = <Path, Err, Wfd>(
	paths: Path[],
	read: (path: Path) => E.Either<Err, Wfd>
): E.Either<NEA.NonEmptyArray<Err>, Wfd[]> =>
	A.array.traverse(E.getValidation(NEA.getSemigroup<Err>()))(
		paths,
		(filepath: Path) => pipeable.pipe(read(filepath), E.mapLeft(NEA.of))
	)
