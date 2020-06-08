import * as M from 'gl-matrix';
import { vec3 } from 'gl-matrix';
import { Camera } from './camera';
import { clamp } from './utils';

/* CONSTANT TUNING VARIABLES */
const move_speed:number = 4;
const v_move_speed:number = 4;
const pitch_speed:number = 1.5;
const yaw_speed:number = 1.5;

/* KEYLIST HANDLERS */
const key_set:Set<number> = new Set();
export function init_handlers():void {
	window.addEventListener("keydown",
		function(e) {
			key_set.add(e.keyCode);
		}
	);
	window.addEventListener("keyup",
		function(e) {
			key_set.delete(e.keyCode);
		}
	);
}

/* MAIN HANDLER */
export function handle_input(cam:Camera, dt:number):void {
	// Movement
	// --------
	let x:number = 0;
	let z:number = 0;
	if(key_set.has(68)) x += 1; // D
	if(key_set.has(65)) x -= 1; // A
	if(key_set.has(83)) z += 1; // S
	if(key_set.has(87)) z -= 1; // W
	move(x, z, cam, dt);

	// V-Movement
	// ----------
	let y:number = 0;
	if(key_set.has(32)) y += 1; // space
	if(key_set.has(90)) y -= 1; // z
	v_move(y, cam, dt);

	// Look
	// ----
	let pitch 	:number = 0;
	let yaw 	:number = 0;
	if(key_set.has(38)) pitch += 1; // up
	if(key_set.has(40)) pitch -= 1; // down
	if(key_set.has(37)) yaw += 1; // left
	if(key_set.has(39)) yaw -= 1; // right
	look(pitch, yaw, cam, dt);
}

function move(x:number, z:number, cam:Camera, dt:number):void {
	const trans:vec3 = M.vec3.create();
	M.vec3.set(trans, x, 0, z);
	M.vec3.scale(trans, trans, move_speed/1000 * dt);
	const zero:vec3 = M.vec3.create();
	M.vec3.rotateY(trans, trans, zero, cam.yaw);
	M.vec3.add(cam.pos, cam.pos, trans); 
}

function v_move(y:number, cam:Camera, dt:number): void {
	const trans:vec3 = M.vec3.create();
	M.vec3.set(trans, 0, y * (v_move_speed/1000 * dt), 0);
	M.vec3.add(cam.pos, cam.pos, trans);
}

function look(p:number, y:number, cam:Camera, dt:number):void {
	cam.pitch = clamp(cam.pitch + (p * pitch_speed/1000 * dt), -Math.PI, Math.PI);
	cam.yaw += y * yaw_speed/1000 * dt;
	if(cam.yaw < 0)
		cam.yaw += 2*Math.PI;
	while(cam.yaw > 2*Math.PI)
		cam.yaw -= 2*Math.PI;
}