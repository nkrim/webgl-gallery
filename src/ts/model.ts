import * as M from 'gl-matrix';
import { vec2, vec3, mat4, quat } from 'gl-matrix';

export class Model {
	// Initialization fields
	// ---------------------
	mesh_id:		number;
	pos:			vec3;
	rot:			quat;
	scale:			vec3;
	// Private values
	// ------------------
	_old_pos:		vec3;
	_old_rot:		quat;
	_old_scale:		vec3;
	_model_m:		mat4;

	/* ------------\
	| CONTSTRUCTOR |
	\------------ */
	constructor(
			mesh_id:		number,
			pos:			vec3,
			rot:			quat,
			scale:			vec3) {
		// set values
		this.mesh_id = mesh_id;
		this.pos = M.vec3.create(); M.vec3.copy(this.pos, pos);
		this.rot = M.quat.create(); M.quat.copy(this.rot, rot);
		this.scale = M.vec3.create(); M.vec3.copy(this.scale, scale);
		// set old values
		this._old_pos = M.vec3.create(); M.vec3.copy(this._old_pos, this.pos);
		this._old_rot = M.quat.create(); M.quat.copy(this._old_rot, this.rot);
		this._old_scale = M.vec3.create(); M.vec3.copy(this._old_scale, this.scale);
		// set constructed values
		this._model_m = M.mat4.create();
		this.get_model_matrix(true);
	}

	same_old_values(): boolean {
		let same_old:boolean = true;
		if(!M.vec3.equals(this.pos, this._old_pos)) {
			same_old = false;
			M.vec3.copy(this._old_pos, this.pos);
		}
		if(!M.quat.equals(this.rot, this._old_rot)) {
			same_old = false;
			M.quat.copy(this._old_rot, this.rot);
		}
		if(!M.vec3.equals(this.scale, this._old_scale)) {
			same_old = false;
			M.vec3.copy(this._old_scale, this.scale);
		}
		return same_old;
	}

	get_model_matrix(force:boolean = false):mat4 {
		if(!force && this.same_old_values()) {
			return this._model_m;
		}
		// M.mat4.fromRotationTranslationScale(this._model_m, this.rot, this.pos, this.scale);
		M.mat4.fromTranslation(this._model_m, this.pos);
		return this._model_m;
	}
}