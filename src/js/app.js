import * as R from './render.js';
import * as ROOM from '../ts/room.ts';
import { Camera } from '../ts/camera.ts';
import * as INPUT from '../ts/input.ts';
import * as M from './gl-matrix.js';
import { interlace_2 } from './geo-primitives.js';
import { room_config } from './room-config.js';
// Shaders
import { default_shader_v, default_shader_f } from './default_shader.js';
import { deferred_pass_v, deferred_pass_f } from './deferred_pass.js';
import { deferred_combine_v, deferred_combine_f } from './deferred_combine.js';

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
	for(let [k, v] of Object.entries(loc_lookup.uniforms))
		shader_data.uniforms[k] = gl.getUniformLocation(shader_program, v);
	return shader_data;
}

function init_buffers(gl, room_list) {
	// quad buffer
	// ----------------------
	// vertex buffer
	const quad_vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, quad_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1,1,-1,1,-1,-1,1,-1]), gl.STATIC_DRAW);
	// index buffer
	const quad_index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad_index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);

	// room buffer
	// ----------------------
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
	const room_vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, room_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all_room_vertices), gl.STATIC_DRAW);
	// index buffer
	const room_index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room_index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(all_room_indices), gl.STATIC_DRAW);

	return {
		quad: {
			vertices: quad_vertex_buffer,
			indices: quad_index_buffer,
		},
		room: {
			vertices: room_vertex_buffer,
			indices: room_index_buffer,
		},
	};
}

/* TEXTURE INITIALIZATION
	- index lookup
	0: gbuffer depth
	1: gbuffer position
	2: gbuffer normal
	3: gbuffer color
*/
function init_textures(gl) {
	const tx_obj = {};
	// depth attachment
	{
		let tx = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tx);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const level = 0;
		const internalFormat = gl.DEPTH_COMPONENT;
		const width = gl.canvas.clientWidth;
		const height = gl.canvas.clientHeight;
		const border = 0;
		const srcFormat = gl.DEPTH_COMPONENT;
		const srcType = gl.UNSIGNED_SHORT;
		const pixel = null;  // empty
		gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType, pixel);
		tx_obj.depth = tx;
	}
	// other attachments
	tx_obj.bufs = []
	for(let i=0; i<4; i++) {
		let tx = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tx);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const level = 0;
		const internalFormat = gl.RGBA;
		const width = gl.canvas.clientWidth;
		const height = gl.canvas.clientHeight;
		const border = 0;
		const srcFormat = gl.RGBA;
		const srcType = gl.FLOAT;
		const pixel = null;  // empty
		gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType, pixel);
		tx_obj.bufs.push(tx);
	}
	return tx_obj;
}

function init_deferred_framebuffer(gl, tx) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tx.depth, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, tx.bufs[0], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, tx.bufs[1], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT2_WEBGL, gl.TEXTURE_2D, tx.bufs[2], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT3_WEBGL, gl.TEXTURE_2D, tx.bufs[3], 0);

	// DRAW BUFFERS
	gl.ext.db.drawBuffersWEBGL([
		gl.ext.db.COLOR_ATTACHMENT0_WEBGL, 
		gl.ext.db.COLOR_ATTACHMENT1_WEBGL, 
		gl.ext.db.COLOR_ATTACHMENT2_WEBGL,
		gl.ext.db.COLOR_ATTACHMENT3_WEBGL,
	]);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}


/* MAIN INITIALIZATION
====================== */
function main_init(gl, room_list) {
	// SHADER INIT
	const shaders = {};
	const default_shader_l = {
		attribs: {
			vertex_pos: 'aVertexPosition',
			normal_dir: 'aNormalDirection',
		},
		uniforms: {
			projection_m: 'uProjection',
			view_m: 'uView',
			model_m: 'uModel'
		}
	};
	shaders.default_shader = init_shader_program(gl, default_shader_v, default_shader_f, default_shader_l);
	const deferred_pass_l = {
		attribs: {
			vertex_pos: 'a_vert',
			normal_dir: 'a_norm',
		},
		uniforms: {
			projection_m: 'u_proj',
			mv_m: 'u_mv',
			it_mv_m: 'u_it_mv',
		}
	}
	shaders.deferred_pass = init_shader_program(gl, deferred_pass_v, deferred_pass_f, deferred_pass_l);
	const deferred_combine_l = {
		attribs: {
			vertex_pos: 'a_vert',
		},
		uniforms: {
			inv_view_m: 'u_view',
			pos_tex: 'u_pos_tex',
			norm_tex: 'u_norm_tex',
			color_tex: 'u_color_tex',
		}
	}
	shaders.deferred_combine = init_shader_program(gl, deferred_combine_v, deferred_combine_f, deferred_combine_l);

	// BUFFER INIT
	const buffer_data = init_buffers(gl, room_list);

	// CAMERA INIT
  	const cam_pos = M.vec3.create();
  	M.vec3.set(cam_pos, 0, 2, 8);
  	const cam = new Camera(cam_pos, 0, 0);

  	// INIT TEXTURES
  	const tx = init_textures(gl);

  	// FRAMEBUFFER INIT
  	const deferred_fb = init_deferred_framebuffer(gl, tx)

	return {
		shaders: shaders,
		buffers: buffer_data,
		room_list: room_list,
		cam: cam,
		tx: tx,
		deferred_fb: deferred_fb,
	}
}


/* MAIN FUNCTION
================ */
let gallery_animation_id = null;
let prev_t = -1;
function frame_tick(gl, program_data) {
	function T(t) {
		// Give grace-frame for accurate dt
		if(prev_t < 0)
			prev_t = t;
		let dt = t - prev_t;

		INPUT.handle_input(program_data.cam, dt);
		R.render(gl, program_data, t);
		gallery_animation_id = requestAnimationFrame(T);

		// Set prev_t
		prev_t = t;
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
  	INPUT.init_handlers();

  	// ENABLE EXTENSIONS
  	const ext_drawbuffers = gl.getExtension('WEBGL_draw_buffers');
  	if(!ext_drawbuffers) {
  		alert('Unsupported WebGL extension WEBGL_draw_buffers, please try another browser (Chrome, Firefox v28).');
  		return;
  	}
  	const ext_oesfloat = gl.getExtension('OES_texture_float');
  	if(!ext_oesfloat) {
  		alert('Unsupported WebGL extension OES_texture_float, please try another browser (Chrome, Firefox).');
  		return;
  	}
  	const ext_depth_texture = gl.getExtension('WEBGL_depth_texture');
  	if(!ext_depth_texture) {
  		alert('Unsupported WebGL extension WEBGL_depth_texture, please try another browser (Chrome, Firefox).');
  		return;
  	}
  	// EXPOSE EXTENSIONS
  	gl.ext = {
  		db: ext_drawbuffers,
  		dt: ext_depth_texture,
  	}

  	// ROOM INIT
  	let room_list = [];
 	for(let i=0; i<room_config.length; i++) {
 		const r = room_config[0];
 		room_list.push(
 			new ROOM.Room(r.wall_paths, r.wall_height, r.floor_indices, r.room_scale)
 		);
 	}
  	console.log(room_list);

  	// PROGRAM INIT
  	let program_data = main_init(gl, room_list);
  	console.log(program_data);

  	/* TEMP DEBUG SETTING */
  	window.glMatrix = M;
  	window.program_data = program_data;

  	// RENDERING (FRAME TICK)
  	gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));

  	// EVENT HANDLERS (PLAY AND STOP BUTTONS)
  	document.querySelector('#play').onclick = function() {
		if(gallery_animation_id === null) {
			gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));
		}
	}
	document.querySelector('#stop').onclick = function() {
		cancelAnimationFrame(gallery_animation_id);
		gallery_animation_id = null;
		prev_t = -1;
	}
}

window.onload = main;