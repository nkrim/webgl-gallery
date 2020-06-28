import * as M from 'gl-matrix';
import { vec3, mat4, quat } from 'gl-matrix';
import { float_eq } from './utils'

// CAMERA CLASS
export class Camera {
	// Public fields
	pos: 	vec3;
	pitch: 	number;
	yaw:	number;

	// Private fields
	_old_pos: vec3;
	_old_pitch: number;
	_old_yaw: number;
	_view_matrix: mat4;
	_look_dir: vec3;

	constructor(pos: vec3, pitch: number, yaw: number) {
		this.pos = M.vec3.create();
		M.vec3.copy(this.pos, pos);
		this.pitch = pitch;
		this.yaw = yaw;

		this._old_pos = M.vec3.create();
		M.vec3.copy(this._old_pos, this.pos);
		this._old_pitch = pitch;
		this._old_yaw = yaw;
		this._view_matrix = M.mat4.create();
		this._look_dir = M.vec3.create();
		this._update_values(true);
	}

	same_old_values(): boolean {
		if(M.vec3.equals(this.pos, this._old_pos)) {
			if(float_eq(this.pitch, this._old_pitch)) {
				if(float_eq(this.yaw, this._old_yaw)) {
					return true;
				}
			}
		}
		else {
			// Only copy pos on old_pos failure
			M.vec3.copy(this._old_pos, this.pos);
		}
		// copy rest regardless
		this._old_pitch = this.pitch;
		this._old_yaw = this.yaw;
		return false;
	}

	_update_values(force:boolean = false):boolean {
		if(!force && this.same_old_values()) {
			return false;
		}
		// view matrix
		const q:quat = M.quat.create();
		M.quat.rotateY(q, q, this.yaw);
		M.quat.rotateX(q, q, this.pitch);
		M.mat4.fromRotationTranslation(this._view_matrix, q, this.pos);
		M.mat4.invert(this._view_matrix, this._view_matrix);
		// look dir
		M.vec3.set(this._look_dir, 0, 0, -1);
		M.vec3.transformQuat(this._look_dir, this._look_dir, q);
		// return
		return true;
	}

	get_view_matrix(force:boolean = false): mat4 {
		this._update_values(force);
		return this._view_matrix;
	}

	get_look_dir(force:boolean = false): vec3 {
		this._update_values(force);
		return this._look_dir;
	}
}