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
	size:		number;
	bias_range:	vec2;
	zplanes: 	vec2;

	sm: WebGLTexture;
	fb: WebGLFramebuffer;

	// Constructed properties
	// ----------------------
	_o_angle_nocos: number;
	_proj_m:		mat4;

	// Constructor
	// -----------
	constructor(	cam:					Camera,
					color:					vec3,
					intensity: 				number,
					inner_outer_angle_deg:	vec2,
					falloff:				number,
					size:					number,
					bias_range:				vec2,	// reccomended value [0.0001,0.005]
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
		this.size = size;
		this.bias_range = M.vec2.create(); M.vec2.copy(this.bias_range, bias_range);
		this.zplanes = M.vec2.create(); M.vec2.copy(this.zplanes, zplanes);

		this.sm = null;
		this.fb = null;

		// construct properties
		this._o_angle_nocos = o_angle_nocos;
		this._proj_m = M.mat4.create();
	}

	// should cache result in the future
	get_projection_matrix():mat4 {
		M.mat4.perspective(this._proj_m, this._o_angle_nocos+0.1, 1.0, this.zplanes[0], this.zplanes[1]);
		return this._proj_m;
	}
}