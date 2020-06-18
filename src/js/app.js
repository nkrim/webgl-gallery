import * as R from '../ts/render.ts';
import * as ROOM from '../ts/room.ts';
import { Camera } from '../ts/camera.ts';
import * as INPUT from '../ts/input.ts';
import { lerp, interlace_n } from '../ts/utils.ts';
import * as M from './gl-matrix.js';
import { room_config } from './room-config.js';
// Shaders
// import { default_shader_v, default_shader_f } from './shaders/default_shader.js';
import { deferred_pass_v, deferred_pass_f } from './shaders/deferred_pass.js';
import { deferred_combine_v, deferred_combine_f } from './shaders/deferred_combine.js';
import { ssao_pass_v, gen_ssao_pass_f, SSAO_KERNEL_SIZE } from './shaders/ssao_pass.js';
import { ssao_blur_v, gen_ssao_blur_f } from './shaders/ssao_blur.js';
import { spotlight_pass_v, spotlight_pass_f } from './shaders/spotlight_pass.js';
import { fxaa_pass_v, gen_fxaa_pass_f } from './shaders/fxaa_pass.js';

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
		const interlaced = interlace_n(
			4,
			[room.mesh_vertices, room.mesh_normals, room.mesh_albedo, room.mesh_rough_metal],
			[3, 				 3, 			    3,                2],
			room.mesh_count_v
		);
		for(let j=0; j<interlaced.length; j++)
			all_room_vertices.push(interlaced[j]);
		Array.prototype.push.apply(all_room_indices, room.mesh_indices);
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

function gen_screen_color_texture(gl, filter_function) {
	const tx = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tx);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter_function);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter_function);
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
	return tx;
}
function gen_screen_depth_texture(gl, filter_function) {
	const tx = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tx);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter_function);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter_function);
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
	return tx;
}

/* TEXTURE INITIALIZATION
	- index lookup
	0: gbuffer depth
	1: gbuffer position
	2: gbuffer normal
	3: gbuffer albedo
	4: gbuffer roughness/metallic
*/
function init_textures(gl) {
	// init tx_obj
	const tx_obj = {};

	// deferred depth attachment
	tx_obj.depth = gen_screen_depth_texture(gl, gl.NEAREST);
	// gbuffer attachments
	tx_obj.bufs = []
	for(let i=0; i<6; i++) {
		tx_obj.bufs.push(gen_screen_color_texture(gl, gl.LINEAR));
	}
	// ssao texture
	tx_obj.ssao_pass = gen_screen_color_texture(gl, gl.NEAREST);
	tx_obj.ssao_blur = gen_screen_color_texture(gl, gl.NEAREST);
	// shadow atlas
	tx_obj.shadow_atlas = gen_screen_depth_texture(gl, gl.NEAREST);
	// light accumulation buffer
	tx_obj.light_val = gen_screen_color_texture(gl, gl.LINEAR);
	// screen write texture
	tx_obj.screen_tex = gen_screen_color_texture(gl, gl.LINEAR);


	return tx_obj;
}

/* Framebuffer Initializations
------------------------------ */
function init_deferred_framebuffer(gl, tx) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tx.depth, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT0_WEBGL, gl.TEXTURE_2D, tx.bufs[0], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT1_WEBGL, gl.TEXTURE_2D, tx.bufs[1], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT2_WEBGL, gl.TEXTURE_2D, tx.bufs[2], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT3_WEBGL, gl.TEXTURE_2D, tx.bufs[3], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.ext.db.COLOR_ATTACHMENT4_WEBGL, gl.TEXTURE_2D, tx.bufs[4], 0);

	// DRAW BUFFERS
	gl.ext.db.drawBuffersWEBGL([
		gl.ext.db.COLOR_ATTACHMENT0_WEBGL, 
		gl.ext.db.COLOR_ATTACHMENT1_WEBGL, 
		gl.ext.db.COLOR_ATTACHMENT2_WEBGL,
		gl.ext.db.COLOR_ATTACHMENT3_WEBGL,
		gl.ext.db.COLOR_ATTACHMENT4_WEBGL,
	]);

	// unbind
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}

function init_standard_write_framebuffer(gl, attachment, texture) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);

	// unbind
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}

function init_shadow_mapping_framebuffer(gl, shadow_atlas_texture) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadow_atlas_texture, 0);

	// unbind
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}

/* SSAO Kernel and noise generation
----------------------------------- */
function gen_ssao_kernel_and_noise(gl, tx_obj) {
	// init vector for operations
	const v = M.vec3.create();

	// generate sample kernel
	const sample_count = SSAO_KERNEL_SIZE;
	const samples = [];
	for(let i=0; i<sample_count; i++) {
		// Generate vector in unit-hemisphere
		M.vec3.set(v, 
			Math.random()*2.0 - 1.0, 
			Math.random()*2.0 - 1.0, 
			Math.random());
		M.vec3.normalize(v, v);
		// Ramp interpolation from center
		let scale = 1.0*i/sample_count;
		scale = lerp(0.1, 1.0, scale*scale);
		M.vec3.scale(v, v, scale);
		// Push sample
		samples.push(...v);
	}
	const sample_data = new Float32Array(samples);

	// generate noise texture values
	const tex_dimension = 4;
	const rotation_count = tex_dimension*tex_dimension;
	const rotations = [];
	for(let i=0; i<rotation_count; i++) {
		M.vec3.set(v,
			Math.random()*2.0 - 1.0, 
			Math.random()*2.0 - 1.0, 
			0);
		rotations.push(...v);
	}
	const rotation_data = new Float32Array(rotations);

	// generate noise texture
	{
		const tx = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tx);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		const level = 0;
		const internalFormat = gl.RGB;
		const width = tex_dimension;
		const height = tex_dimension;
		const border = 0;
		const srcFormat = gl.RGB;
		const srcType = gl.FLOAT;
		const pixel = rotation_data;  // rotations array
		gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType, pixel);
		// set as rot_noise
		tx_obj.rot_noise = tx;
	}

	// return sample kernel
	return sample_data;
}


/* MAIN INITIALIZATION
====================== */
function main_init(gl, room_list) {
	// SHADER INIT
	const shaders = {};
	const deferred_pass_l = {
		attribs: {
			vertex_pos: 'a_vert',
			normal_dir: 'a_norm',
			albedo: 'a_albedo',
			rough_metal: 'a_rough_metal',
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
			view_m: 'u_view',
			pos_tex: 'u_pos_tex',
			norm_tex: 'u_norm_tex',
			color_tex: 'u_color_tex',
			ssao_tex: 'u_ssao_tex',
			light_tex: 'u_light_tex',
		}
	}
	shaders.deferred_combine = init_shader_program(gl, deferred_combine_v, deferred_combine_f, deferred_combine_l);
	const ssao_pass_l = {
		attribs: {
			vertex_pos: 'a_vert',
		},
		uniforms: {
			pos_tex: 'u_pos_tex',
			norm_tex: 'u_norm_tex',
			noise_tex: 'u_noise_tex',
			samples_a: 'u_samples',
			proj_m: 'u_proj',
		}
	}
	shaders.ssao_pass = init_shader_program(gl, ssao_pass_v, 
		gen_ssao_pass_f(gl.canvas.clientWidth, gl.canvas.clientHeight),
		ssao_pass_l);
	const ssao_blur_l = {
		attribs: {
			vertex_pos: 'a_vert',
		},
		uniforms: {
			ssao_tex: 'u_ssao_tex',
		}
	}
	shaders.ssao_blur = init_shader_program(gl, ssao_blur_v, 
		gen_ssao_blur_f(gl.canvas.clientWidth, gl.canvas.clientHeight),
		ssao_blur_l);
	const spotlight_pass_l = {
		attribs: {
			vertex_pos: 'a_vert',
		},
		uniforms: {
			pos_tex: 'u_pos_tex',
			norm_tex: 'u_norm_tex',
			albedo_tex: 'u_albedo_tex',
			rough_metal_tex: 'u_rough_metal_tex',
			light_pos: 'u_light_pos',
			light_dir: 'u_light_dir',
			light_color: 'u_light_color',
			light_i_angle: 'u_light_i_angle',
			light_o_angle: 'u_light_o_angle',
			light_falloff: 'u_light_falloff',
		}
	}
	shaders.spotlight_pass = init_shader_program(gl, spotlight_pass_v, spotlight_pass_f, spotlight_pass_l);
	const fxaa_pass_l = {
		attribs: {
			vertex_pos: 'a_vert',
		},
		uniforms: {
			screen_tex: 'u_screen_tex',
		}
	}
	shaders.fxaa_pass = init_shader_program(gl, fxaa_pass_v, 
		gen_fxaa_pass_f(gl.canvas.clientWidth, gl.canvas.clientHeight),
		fxaa_pass_l);

	// BUFFER INIT
	const buffer_data = init_buffers(gl, room_list);

	// CAMERA INIT
  	const cam_pos = M.vec3.create();
  	M.vec3.set(cam_pos, 0, 2, 8);
  	const cam = new Camera(cam_pos, 0, 0);

  	// INIT TEXTURES
  	const tx = init_textures(gl);

  	// FRAMEBUFFER INIT
  	const fb_obj = {};
  	fb_obj.deferred = init_deferred_framebuffer(gl, tx);
  	fb_obj.ssao_pass = init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.ssao_pass);
  	fb_obj.ssao_blur = init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.ssao_blur);
  	fb_obj.light_val = init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.light_val);
  	fb_obj.deferred_combine = init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.screen_tex);

  	// SSAO DATA INIT
  	const sample_kernel = gen_ssao_kernel_and_noise(gl, tx);

	return {
		shaders: shaders,
		buffers: buffer_data,
		room_list: room_list,
		cam: cam,
		tx: tx,
		fb: fb_obj,
		ssao_kernel: sample_kernel,
	}
}


/* MAIN FUNCTION
================ */
let gallery_animation_id = null;
let prev_t = -1;
let frame_count = 0;
let time_of_last_tracked_frame = -1;
function frame_tick(gl, program_data) {
	function T(t) {
		// Give grace-frame for accurate dt
		if(prev_t < 0)
			prev_t = t;
		let dt = t - prev_t;

		INPUT.handle_input(program_data.cam, dt);
		R.render(gl, program_data, t);
		gallery_animation_id = requestAnimationFrame(T);

		if(time_of_last_tracked_frame < 0)
			time_of_last_tracked_frame = prev_t;
		frame_count++;
		// Reset every 5 seconds
		if(t - time_of_last_tracked_frame > 5000) {
			console.log(`fps: ${getFPS()}`);
			resetFPS();
			time_of_last_tracked_frame = t;
		}
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
  		alert('Unsupported WebGL extension WEBGL_draw_buffers, please try another updated browser (Chrome, Firefox v28).');
  		return;
  	}
  	const ext_oesfloat = gl.getExtension('OES_texture_float');
  	if(!ext_oesfloat) {
  		alert('Unsupported WebGL extension OES_texture_float, please try another updated browser (Chrome, Firefox).');
  		return;
  	}
  	const ext_oesfloat_linear = gl.getExtension('OES_texture_float_linear');
  	if(!ext_oesfloat_linear) {
  		alert('Unsupported WebGL extension OES_texture_float_linear, please try another updated browser (Chrome, Firefox).');
  		return;
  	}
  	const ext_color_buffer_float = gl.getExtension('WEBGL_color_buffer_float');
  	if(!ext_oesfloat) {
  		alert('Unsupported WebGL extension WEBGL_color_buffer_float, please try another updated browser (Chrome, Firefox).');
  		return;
  	}
  	const ext_depth_texture = gl.getExtension('WEBGL_depth_texture');
  	if(!ext_depth_texture) {
  		alert('Unsupported WebGL extension WEBGL_depth_texture, please try another updated browser (Chrome, Firefox).');
  		return;
  	}
  	/*const oes_texture_half_float = gl.getExtension('OES_texture_half_float')
  	if(!oes_texture_half_float) {
  		alert('Unsupported WebGL extension OES_texture_half_float, please try another updated browser (Chrome, Firefox).');
  		return;
  	}*/
  	/*const ext_color_buffer_half_float = gl.getExtension('EXT_color_buffer_half_float');
  	if(!ext_color_buffer_half_float) {
  		alert('Unsupported WebGL extension EXT_color_buffer_half_float, please try another updated browser (Chrome, Firefox).');
  		return;
  	}*/
  	// EXPOSE EXTENSIONS
  	gl.ext = {
  		db: ext_drawbuffers,
  		dt: ext_depth_texture,
  		//thf: oes_texture_half_float,
  		//hf: ext_color_buffer_half_float,
  	}



  	// ROOM INIT
  	let room_list = [];
 	for(let i=0; i<room_config.length; i++) {
 		const r = room_config[0];
 		room_list.push(
 			new ROOM.Room(
 				r.wall_paths, r.wall_height, r.floor_indices, r.room_scale,
 				r.wall_albedo, r.wall_rough_metal, r.floor_albedo, r.floor_rough_metal, r.ceil_albedo, r.ceil_rough_metal,
 				r.spotlights)
 		);
 	}
  	console.log(room_list);

  	// PROGRAM INIT
  	let program_data = main_init(gl, room_list);
  	console.log(program_data);




  	/* TEMP DEBUG SETTING */
  	window.webgl = gl;
  	window.glMatrix = M;
  	window.program_data = program_data;

  	// RENDERING (FRAME TICK)
  	gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));

  	// EVENT HANDLERS (PLAY AND STOP BUTTONS)
  	document.querySelector('#play').onclick = function() {
		if(gallery_animation_id === null) {
			resetFPS();
			gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));
		}
	}
	document.querySelector('#stop').onclick = function() {
		cancelAnimationFrame(gallery_animation_id);
		gallery_animation_id = null;
		prev_t = -1;
	}
}

window.getFPS = function() {
	return frame_count / ((prev_t - time_of_last_tracked_frame) / 1000);
}
window.resetFPS = function() {
	frame_count = 0;
	time_of_last_tracked_frame = prev_t;
}

window.onload = main;