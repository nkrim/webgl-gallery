import * as M from 'gl-matrix';
import { vec2, vec3, mat4, quat } from 'gl-matrix';
import { Camera } from './camera';
import { DEG_TO_RAD, vec3_gamma_to_linear } from './utils';

export class Spotlight {
	// Spotlight properties
	// --------------------
	cam:		Camera;
	color:		vec3;
	intensity:	number;
	i_angle:	number;
	o_angle: 	number;
	falloff:	number;
	zplanes: 	vec2;

	// Constructed properties
	// ----------------------
	proj_m:		mat4;

	// Constructor
	// -----------
	constructor(	cam:					Camera,
					color:					vec3,
					intensity: 				number,
					inner_outer_angle_deg:	vec2,
					falloff:				number,
					zplanes:				vec2) {
		// set properties
		this.cam = cam;
		this.color = M.vec3.create(); M.vec3.copy(this.color, color);
		vec3_gamma_to_linear(this.color); // GAMMA TO LINEAR
		this.intensity = intensity;
		this.i_angle = Math.cos(inner_outer_angle_deg[0]*DEG_TO_RAD/2);
		let o_angle_nocos = inner_outer_angle_deg[1]*DEG_TO_RAD;
		this.o_angle = Math.cos(o_angle_nocos/2);
		this.falloff = falloff;
		this.zplanes = zplanes;

		// construct properties
		this.proj_m = M.mat4.create();
		M.mat4.perspective(this.proj_m, o_angle_nocos, 1.0, this.zplanes[0], this.zplanes[1]); // !!!!!!MEGA TEMPORARY
	}
}