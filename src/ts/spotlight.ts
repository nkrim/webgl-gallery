import * as M from 'gl-matrix';
import { vec3, mat4, quat } from 'gl-matrix';
import { Camera } from './camera';
import { DEG_TO_RAD, vec3_gamma_to_linear } from './utils';

export class Spotlight {
	// Spotlight properties
	// --------------------
	cam:		Camera;
	color:		vec3;
	intensity:	number;
	i_angle:	number;
	o_angle:	number;
	falloff:	number;

	// Constructed properties
	// ----------------------
	proj_m:		mat4;

	// Constructor
	// -----------
	constructor(	cam:				Camera,
					color:				vec3,
					intensity: 			number,
					inner_angle_deg:	number,
					outer_angle_deg:	number,
					falloff:			number) {
		// set properties
		this.cam = cam;
		this.color = M.vec3.create(); M.vec3.copy(this.color, color);
		vec3_gamma_to_linear(this.color); // GAMMA TO LINEAR
		this.intensity = intensity;
		this.i_angle = Math.cos(inner_angle_deg*DEG_TO_RAD/2);
		this.o_angle = Math.cos(outer_angle_deg*DEG_TO_RAD/2);
		this.falloff = falloff;

		// construct properties
		this.proj_m = M.mat4.create();
		M.mat4.perspective(this.proj_m, this.o_angle, 1.0, 0.1, 30.0); // !!!!!!MEGA TEMPORARY
	}
}