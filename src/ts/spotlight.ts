import * as M from 'gl-matrix';
import { vec3, mat4, quat } from 'gl-matrix';
import { DEG_TO_RAD } from './utils';

export class Spotlight {
	// Spotlight properties
	// --------------------
	pos:		vec3;
	dir:		vec3;
	i_angle:	number;
	o_angle:	number;
	falloff:	number;

	// Constructor
	// -----------
	constructor(	position:			vec3,
					direction:			vec3,
					inner_angle_deg:	number,
					outer_angle_deg:	number,
					falloff:			number) {
		this.pos = M.vec3.create();
		M.vec3.copy(this.pos, position);
		this.dir = M.vec3.create();
		M.vec3.normalize(this.dir, direction);
		this.i_angle = Math.cos(inner_angle_deg*DEG_TO_RAD/2);
		this.o_angle = Math.cos(outer_angle_deg*DEG_TO_RAD/2);
		this.falloff = falloff;
	}
}