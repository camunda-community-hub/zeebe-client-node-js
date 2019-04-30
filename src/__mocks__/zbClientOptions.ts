import { Loglevel } from '../lib/interfaces'

export const clientOptions = {
	_loglevel: 'NONE' as Loglevel,
	// it's a setter!
	set loglevel(value: Loglevel) {
		this._loglevel = value
	},
	get loglevel(): Loglevel {
		return this._loglevel
	},
}
