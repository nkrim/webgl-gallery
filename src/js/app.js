import * as R from './render.js';
import * as ROOM from '../ts/room.ts';
import * as M from './gl-matrix.js';
import { interlace_2 } from './geo-primitives.js'

/* INITIALIZING FUNCTIONS
========================= */
function load_shader(gl, type, source) {
  	const shader = gl.createShader(type);

  	// Send the source to the shader object
  	gl.shaderSource(shader, source);

  	// Compile the shader program
 	gl.compileShader(shader);

 	// See if it compiled successfully
  	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function init_shader_program(gl, vs_source, fs_source, loc_lookup) {
	const vertex_shader = load_shader(gl, gl.VERTEX_SHADER, vs_source);
	const fragment_shader = load_shader(gl, gl.FRAGMENT_SHADER, fs_source);

	// Create the shader program
	const shader_program = gl.createProgram();
	gl.attachShader(shader_program, vertex_shader);
	gl.attachShader(shader_program, fragment_shader);
	gl.linkProgram(shader_program);

	// If creating the shader program failed, alert
	if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
		alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shader_program));
		return null;
	}

	// Lookup locations and fill into shader_data
	let shader_data = {
		prog: shader_program,
		attribs: {},
		uniforms: {}
	};
	for(let [k, v] of Object.entries(loc_lookup.attribs))
		shader_data.attribs[k] = gl.getAttribLocation(shader_program, v);
	console.log(Object.entries(loc_lookup.uniforms))
	for(let [k, v] of Object.entries(loc_lookup.uniforms))
		shader_data.uniforms[k] = gl.getUniformLocation(shader_program, v);
	console.log(shader_data);
	return shader_data;
}

function init_buffers(gl, room_list) {
	// build interlaced array
	let all_room_vertices = [];
	let all_room_indices = [];
	for(let i=0; i<room_list.length; i++) {
		const room = room_list[i];
		const offset_v = all_room_vertices.length;
		const offset_i = all_room_indices.length;
		Array.prototype.push.apply(all_room_vertices, interlace_2(room.wall_vertices, room.wall_normals, 3, 3, room.wall_count_v));
		Array.prototype.push.apply(all_room_indices, room.wall_indices);
		// set room offset
		room.buffer_offset_v = offset_v;
		room.buffer_offset_i = offset_i;
	}

	// vertex buffer
	const vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all_room_vertices), gl.STATIC_DRAW);
	// index buffer
	const index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(all_room_indices), gl.STATIC_DRAW);

	return {
		vertices: vertex_buffer,
		indices: index_buffer,
	};
}


/* MAIN INITIALIZATION
====================== */
function main_init(gl, room_list) {
	// SHADER INIT
	const vs_source = default_shader_v;
	const fs_source = default_shader_f;
	const locations = {
		attribs: {
			vertex_pos: 'aVertexPosition',
			normal_dir: 'aNormalDirection',
		},
		uniforms: {
			projection_m: 'uProjectionMatrix',
			modelview_m: 'uModelViewMatrix'
		}
	};
	const shader_data = init_shader_program(gl, vs_source, fs_source, locations);

	// BUFFER INIT
	const buffer_data = init_buffers(gl, room_list);

	return {
		shader: shader_data,
		buffers: buffer_data,
		room_list: room_list
	}
}


/* MAIN FUNCTION
================ */
let gallery_animation_id = null;
function frame_tick(gl, program_data) {
	function T(t) {
		R.render(gl, program_data.shader, program_data.buffers, program_data.room_list, t);
		gallery_animation_id = requestAnimationFrame(T);
	}
	return T;
}
function main() {
	// Setup context
	const canvas = document.querySelector('#glCanvas');
	const gl = canvas.getContext('webgl');
	if (gl === null) {
   		alert("Unable to initialize WebGL. Your browser or machine may not support it.");
    	return;
  	}

  	let room_list = [];
  	room_list.push(new ROOM.Room([[1,1,1,-1,-1,-1,-1,1]], 3));
  	room_list.push(new ROOM.Room([[-1,1,-1,-1,-2,-1,-2,1]], 3));
  	console.log(room_list);

  	// INIT
  	let program_data = main_init(gl, room_list);

  	// RENDERING (FRAME TICK)
  	gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));

  	// EVENT HANDLERS (PLAY AND STOP BUTTONS)
  	document.querySelector('#play').onclick = function() {
		if(gallery_animation_id === null)
			gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));
	}
	document.querySelector('#stop').onclick = function() {
		cancelAnimationFrame(gallery_animation_id);
		gallery_animation_id = null;
	}
}

window.onload = main;