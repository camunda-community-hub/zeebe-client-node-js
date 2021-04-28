import { either as E, pipeable } from 'fp-ts'
import * as A from 'fp-ts/lib/Array'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as ZB from '../interfaces-1.0'

export const isBuffer = (
	wf: ZB.DeployProcessBuffer | ZB.DeployProcessFiles
): wf is ZB.DeployProcessBuffer => !!(wf as ZB.DeployProcessBuffer).definition

export const bufferOrFiles = (
	wf: ZB.DeployProcessFiles | ZB.DeployProcessBuffer
): E.Either<ZB.DeployProcessBuffer[], string[]> =>
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
