import * as R from '../ts/render.ts';
import * as ROOM from '../ts/room.ts';
import { Camera } from '../ts/camera.ts';
import * as INPUT from '../ts/input.ts';
import { lerp, interlace_n, gaussian_kernel_1d, EPSILON } from '../ts/utils.ts';
import * as S from '../ts/settings.ts';
import * as M from './gl-matrix.js';
import { load_room, room_config } from '../ts/room-config.ts';
import { attribute_locs, init_mesh_vao } from '../ts/mesh.ts';
import { TextureManager, SHADOWMAP_SIZE } from '../ts/texture_manager.ts';
// Shaders
// import { default_shader_v, default_shader_f } from './shaders/default_shader.js';
import { deferred_pass_l, deferred_pass_v, deferred_pass_f } from '../shaders/deferred_pass.js';
import { deferred_combine_l, deferred_combine_v, gen_deferred_combine_f } from '../shaders/deferred_combine.js';
import { ssao_pass_l, ssao_pass_v, gen_ssao_pass_f, gen_ssao_kernel } from '../shaders/ssao_pass.ts';
import { ssao_blur_l, ssao_blur_v, gen_ssao_blur_f } from '../shaders/ssao_blur.js';
import { spotlight_pass_l, spotlight_pass_v, gen_spotlight_pass_f, 
		PCSS_BLOCKER_GRID_SIZE, PCSS_POISSON_SAMPLE_COUNT, PCF_POISSON_SAMPLE_COUNT } from '../shaders/spotlight_pass.js';
import { fxaa_pass_l, fxaa_pass_v, gen_fxaa_pass_f, FXAA_QUALITY_SETTINGS } from '../shaders/fxaa_pass.ts';
import { shadowmap_pass_l, shadowmap_pass_v, shadowmap_pass_f } from '../shaders/shadowmap_pass.js';
import { evsm_pass_l, evsm_pass_v, evsm_pass_f } from '../shaders/evsm_pass.js';
import { evsm_prefilter_l, evsm_prefilter_v, gen_evsm_prefilter_f } from '../shaders/evsm_prefilter.js';

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

/*export const attribute_locs = {
	position: 0,
	normal: 1,
	albedo: 2,
	rough_metal: 3,
}*/
function init_vaos(gl, room_list) {
	// quad buffer
	// ----------------------
	// vao
	const quad_vao = gl.createVertexArray();
	gl.bindVertexArray(quad_vao);
	// vertex buffer
	const quad_vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, quad_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1,1,-1,1,-1,-1,1,-1]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(attribute_locs.position);
	gl.vertexAttribPointer(attribute_locs.position, 2, gl.FLOAT, false, 0, 0);
	// index buffer
	const quad_index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quad_index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
	// unbind vao
	gl.bindVertexArray(null);


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
		// !!!IMPORTANT HAVE TO ADD offset_v TO MESH_INDICES
		Array.prototype.push.apply(all_room_indices, room.mesh_indices);
		// set room offset
		room.buffer_offset_v = offset_v;
		room.buffer_offset_i = offset_i;
	}
	// create vao
	const room_vao = gl.createVertexArray();
	gl.bindVertexArray(room_vao);
	// vertex buffer
	const room_vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, room_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all_room_vertices), gl.STATIC_DRAW);
	// set attribute information
	const full_stride = 44; // 12+12+12+8
	gl.enableVertexAttribArray(attribute_locs.position);
	gl.vertexAttribPointer(attribute_locs.position, 3, gl.FLOAT, false, full_stride, 0);
	gl.enableVertexAttribArray(attribute_locs.normal);
	gl.vertexAttribPointer(attribute_locs.normal, 3, gl.FLOAT, false, full_stride, 12);
	gl.enableVertexAttribArray(attribute_locs.albedo);
	gl.vertexAttribPointer(attribute_locs.albedo, 3, gl.FLOAT, false, full_stride, 24);
	gl.enableVertexAttribArray(attribute_locs.rough_metal);
	gl.vertexAttribPointer(attribute_locs.rough_metal, 2, gl.FLOAT, false, full_stride, 36);
	// index buffer
	const room_index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room_index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(all_room_indices), gl.STATIC_DRAW);
	// unbind vao
	gl.bindVertexArray(null);

	// player buffer
	// -------------
	// vao
	const player_vao = gl.createVertexArray();
	gl.bindVertexArray(player_vao);
	// vertex buffer
	const player_vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, player_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1,0,1, 1,0,-1, -1,0,-1, -1,0,1, 0,1,0, 0,-1,0]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(attribute_locs.position);
	gl.vertexAttribPointer(attribute_locs.position, 3, gl.FLOAT, false, 0, 0);
	// index buffer
	const player_index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, player_index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,4,1,2,4,2,3,4,3,0,4,0,3,5,3,2,5,2,1,5,1,0,5]), gl.STATIC_DRAW);
	// unbind vao
	gl.bindVertexArray(null);

	// mesh buffer
	// -----------
	const mesh_vao = init_mesh_vao(gl);

	return {
		quad: quad_vao,
		room: room_vao,
		player: player_vao,
		mesh: mesh_vao,
	};
}

/* Framebuffer Initializations
------------------------------ */
function init_deferred_framebuffer(gl, depth_tex, gbuffer) {
	const fb = gl.createFramebuffer();

	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth_tex, 0);

	let buffer_attachments = [];
	for(let i=0; i<gbuffer.length; i++) {
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0+i, gl.TEXTURE_2D, gbuffer[i], 0);
		buffer_attachments.push(gl.COLOR_ATTACHMENT0+i);
	}
	// DRAW BUFFERS
	gl.drawBuffers(buffer_attachments);

	// unbind
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}

function init_standard_write_framebuffer(gl, texture, attachment=gl.COLOR_ATTACHMENT0) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);

	// unbind
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}

function init_shadowmapping_framebuffer(gl, shadow_map, color_attachment) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadow_map, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color_attachment, 0);

	// unbind
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return fb;
}

/* PCSS SAMPLE GENERATORS
------------------------- */
function gen_pcss_blocker_samples(blocker_grid_size) {
	// init output list
	const samples = [];
	// populate samples (random points in unit square [0,1])
	// develop grid so each sample fits in some grid square, ensuring sufficient surface area
	const grid_square_size = 1/blocker_grid_size;
	let r_offset = 0;
	for(let r=0; r<blocker_grid_size; r++) {
		let c_offset = 0;
		for(let c=0; c<blocker_grid_size; c++) {
			samples.push(
				(Math.random()*grid_square_size) + c_offset - 0.5,
				(Math.random()*grid_square_size) + r_offset - 0.5);
			c_offset += grid_square_size;
		}
		r_offset += grid_square_size;
	}
	// return array
	return new Float32Array(samples);
}

// generates poisson disc with R of 1.0, and then scaled down to fit within the range [-0.5,0.5]
function gen_poisson_disc_samples(num_samples, k_iters) {
	// init samples list
	const samples_vec2 = [];
	for(let i=0; i<num_samples; i++)
		samples_vec2.push(M.vec2.create());
	// init queue and back-queue
	let to_search = [];
	let next_to_search = [];

	// get starting point
	M.vec2.set(samples_vec2[0], Math.random(), Math.random());
	to_search.push(samples_vec2[0]);

	// begin sampling
	const v = M.vec2.create();
	const one_eps = 1.0+EPSILON;
	let i=1;
	while(i < num_samples) {
		// search active samples
		for(let j=0; j<to_search.length; j++) {
			const p = to_search[j];
			let valid_sample_found = false;

			// attempt sampling
			const seed = Math.random();
			for(let k=0; k<k_iters; k++) {
				const theta = 2*Math.PI*(seed + k/k_iters);
				M.vec2.set(v, 
					p[0] + one_eps*Math.cos(theta),
					p[1] + one_eps*Math.sin(theta));

				// check validity of sample
				let valid_sample = true;
				for(let s=0; valid_sample&&s<i; s++) {
					if(M.vec2.sqrDist(v, samples_vec2[s]) < 1)
						valid_sample = false;
				}
				if(valid_sample) {
					valid_sample_found = true;
					M.vec2.copy(samples_vec2[i], v);
					to_search.push(samples_vec2[i]);
					i++;
					if(i >= num_samples)
						break;
				}
				// one may continue sampling around this point until k_iters is exhausted
			}

			// if valid sample found, add to next_to_search
			if(valid_sample_found) {
				if(i >= num_samples) // exit if number of samples is complete
					break;
				next_to_search.push(p);
			}
		}
		// once to_search is exhausted, swap with next_to_search
		to_search = next_to_search;
		next_to_search = [];
	}

	// scale samples to [-0.5,0.5] range
	// find min/max values
	let min_x = samples_vec2[0][0]; let max_x = min_x;
	let min_y = samples_vec2[0][1]; let max_y = min_y;
	for(let i=1; i<num_samples; i++) {
		const s = samples_vec2[i];
		if(s[0] < min_x)		min_x = s[0];
		else if(s[0] > max_x) 	max_x = s[0];
		if(s[1] < min_y)		min_y = s[1];
		else if(s[1] > max_y) 	max_y = s[1];
	}
	const min_vec = M.vec2.create(); M.vec2.set(min_vec, min_x, min_y);
	const scale = 1/Math.max(max_x - min_x, max_y - min_y);
	const center_vec = M.vec2.create(); M.vec2.set(center_vec, 0.5, 0.5);
	// scale outputs
	for(let i=0; i<num_samples; i++) {
		const s = samples_vec2[i];
		M.vec2.sub(s, s, min_vec);
		M.vec2.scale(s, s, scale);
		M.vec2.sub(s, s, center_vec);
	}

	// construct output array
	const out = [];
	for(let i=0; i<num_samples; i++)
		out.push(...samples_vec2[i]);
	return new Float32Array(out);

}


/* MAIN INITIALIZATION
====================== */
function main_init(gl, room_list) {
	// SETTINGS INIT
	let settings_obj = Object.create(S.DEFAULT_SETTINGS);

	// INIT TEXTURES
	const image_textures = [
		['blue_noise', './img/LDR_RGB1_3.png'],
		['blue_noise_1d', './img/LDR_LLL1_3.png'],
	];
  	const tx = new TextureManager(gl, [gl.canvas.clientWidth,gl.canvas.clientHeight], image_textures);

	// SHADER INIT
	const gaussian_kernel_default = gaussian_kernel_1d(15);
	let shaders = {
		shadowmap_pass: 	init_shader_program(gl, shadowmap_pass_v, shadowmap_pass_f, shadowmap_pass_l),
		evsm_pass: 			init_shader_program(gl, evsm_pass_v, evsm_pass_f, evsm_pass_l),
		evsm_prefilter_x: 	init_shader_program(gl, evsm_prefilter_v, 
									gen_evsm_prefilter_f(gaussian_kernel_default, true), evsm_pass_l),
		evsm_prefilter_y: 	init_shader_program(gl, evsm_prefilter_v, 
									gen_evsm_prefilter_f(gaussian_kernel_default, false), evsm_pass_l),
		deferred_pass: 		init_shader_program(gl, deferred_pass_v, deferred_pass_f, deferred_pass_l),
		deferred_combine: 	init_shader_program(gl, deferred_combine_v, 
								gen_deferred_combine_f(gl.canvas.clientWidth, gl.canvas.clientHeight), deferred_combine_l),
		ssao_pass: 			init_shader_program(gl, ssao_pass_v, 
								gen_ssao_pass_f(gl.canvas.clientWidth, gl.canvas.clientHeight), ssao_pass_l),
		ssao_blur: 			init_shader_program(gl, ssao_blur_v, 
								gen_ssao_blur_f(gl.canvas.clientWidth, gl.canvas.clientHeight), ssao_blur_l),
		spotlight_pass: 	init_shader_program(gl, spotlight_pass_v, 
								gen_spotlight_pass_f(
									gl.canvas.clientWidth, gl.canvas.clientHeight,
									gen_poisson_disc_samples(PCF_POISSON_SAMPLE_COUNT, PCF_POISSON_SAMPLE_COUNT/2),
									gen_poisson_disc_samples(PCSS_POISSON_SAMPLE_COUNT, PCSS_POISSON_SAMPLE_COUNT/2)
								), spotlight_pass_l),
		fxaa_pass_variants: [
				init_shader_program(gl, fxaa_pass_v, 
					gen_fxaa_pass_f(gl.canvas.clientWidth, gl.canvas.clientHeight, FXAA_QUALITY_SETTINGS[0]), 
					fxaa_pass_l),
				init_shader_program(gl, fxaa_pass_v, 
					gen_fxaa_pass_f(gl.canvas.clientWidth, gl.canvas.clientHeight, FXAA_QUALITY_SETTINGS[1]), 
					fxaa_pass_l),
			],
	};

	// BUFFER INIT
	const vaos = init_vaos(gl, room_list);

	// CAMERA INIT
  	const cam_pos = M.vec3.create();
  	// M.vec3.set(cam_pos, 0, 2, 8);
  	M.vec3.set(cam_pos, 10, 2, 6);
  	const cam = new Camera(cam_pos, 0, Math.PI/4);//0);

  	// FRAMEBUFFER INIT
  	const fb_obj = {
  		shadowmap_pass: 	init_shadowmapping_framebuffer(gl, tx.sm_depth_generic, tx.sm_linear_generic),
  		evsm_pass: 			init_standard_write_framebuffer(gl, tx.sm_evsm_generic),
  		evsm_prefilter: 	init_standard_write_framebuffer(gl, tx.sm_prefilter_temp),
		deferred: 			init_deferred_framebuffer(gl, tx.screen_depth, tx.gbuffer),
		ssao_pass: 			init_standard_write_framebuffer(gl, tx.ssao_preblur),
		ssao_blur: 			init_standard_write_framebuffer(gl, tx.ssao),
		light_val: 			init_standard_write_framebuffer(gl, tx.light_accum),
		screen_out_a: 		init_standard_write_framebuffer(gl, tx.screen_out_a),
		screen_out_b: 		init_standard_write_framebuffer(gl, tx.screen_out_b),
	};

  	// PCSS BLOCKER SEARCH GRID
  	const pcss_blocker_samples = gen_poisson_disc_samples(PCSS_POISSON_SAMPLE_COUNT, PCSS_POISSON_SAMPLE_COUNT/2);//gen_pcss_blocker_samples(PCSS_BLOCKER_GRID_SIZE);
  	// DEBUG
  	/*if(true) {
  		const canvas = document.querySelector('#blockerCanvas');
  		canvas.style.display = '';
  		const ctx = canvas.getContext('2d');
  		const scale = 100;
  		for(let i=0; i<pcss_blocker_samples.length; i+=2) {
  			ctx.beginPath();
  			ctx.arc(
  				pcss_blocker_samples[i]*scale + canvas.clientWidth/2, 
  				pcss_blocker_samples[i+1]*scale + canvas.clientHeight/2, 
  				0.25*scale/PCSS_BLOCKER_GRID_SIZE, 0, 2*Math.PI);
  			ctx.stroke();
  		}
  	}*/

  	// POISSON DISC SAMPLES
  	const pcss_poisson_samples = gen_poisson_disc_samples(PCF_POISSON_SAMPLE_COUNT, PCF_POISSON_SAMPLE_COUNT/2);
  	// DEBUG
  	/*if(true) {
  		const canvas = document.querySelector('#poissonCanvas');
  		canvas.style.display = '';
  		const ctx = canvas.getContext('2d');
  		const scale = 100;
  		for(let i=0; i<PCSS_POISSON_SAMPLE_COUNT*2; i+=2) {
  			ctx.beginPath();
  			ctx.arc(
  				pcss_poisson_samples[i]*scale + canvas.clientWidth/2, 
  				pcss_poisson_samples[i+1]*scale + canvas.clientHeight/2, 
  				0.05*scale, 0, 2*Math.PI);
  			ctx.stroke();
  		}
  	}*/

	return {
		shaders: shaders,
		vaos: vaos,
		room_list: room_list,
		cam: cam,
		tx: tx,
		fb: fb_obj,
		ssao_kernel: gen_ssao_kernel(gl),
		blocker_samples: pcss_blocker_samples,
		poisson_samples: pcss_poisson_samples,
		settings: settings_obj,
	}
}


/* MAIN FUNCTION
================ */
let gallery_animation_id = null;
let prev_t = -1;
let frame_count = 0;
let time_of_last_tracked_frame = -1;
const fps_write_interval = 2000;
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
		if(t - time_of_last_tracked_frame > fps_write_interval) {
			console.log(`fps: ${getFPS()}`);
			resetFPS();
			time_of_last_tracked_frame = t;
		}
		// Set prev_t
		prev_t = t;
	}
	return T;
}

function play(gl, program_data) {
	if(gallery_animation_id === null) {
		resetFPS();
		gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));
	}
}
function pause() {
	if(gallery_animation_id !== null) {
		cancelAnimationFrame(gallery_animation_id);
		gallery_animation_id = null;
		prev_t = -1;
	}
}

function main() {
	// Setup context
	const canvas = document.querySelector('#glCanvas');
	const gl = canvas.getContext('webgl2', {antialias: false});
	if (gl === null) {
   		alert("Unable to initialize WebGL2. Your browser or machine may not support it.");
    	return;
  	}
  	INPUT.init_handlers();

  	// ENABLE EXTENSIONS
  	/*const ext_drawbuffers = gl.getExtension('WEBGL_draw_buffers');
  	if(!ext_drawbuffers) {
  		alert('Unsupported WebGL extension WEBGL_draw_buffers, please try another updated browser (Chrome, Firefox v28).');
  		return;
  	}*/
  	/*const ext_oesfloat = gl.getExtension('OES_texture_float');
  	if(!ext_oesfloat) {
  		alert('Unsupported WebGL extension OES_texture_float, please try another updated browser (Chrome, Firefox).');
  		return;
  	}*/
  	const ext_oesfloat_linear = gl.getExtension('OES_texture_float_linear');
  	if(!ext_oesfloat_linear) {
  		alert('Unsupported WebGL extension OES_texture_float_linear, please try another updated browser (Chrome, Firefox).');
  		return;
  	}
  	const ext_color_buffer_float = gl.getExtension('EXT_color_buffer_float');
  	if(!ext_color_buffer_float) {
  		alert('Unsupported WebGL extension EXT_color_buffer_float, please try another updated non-mobile browser (Chrome, Firefox).');
  		return;
  	}
  	/*const ext_depth_texture = gl.getExtension('WEBGL_depth_texture');
  	if(!ext_depth_texture) {
  		alert('Unsupported WebGL extension WEBGL_depth_texture, please try another updated browser (Chrome, Firefox).');
  		return;
  	}*/
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
  		//db: ext_drawbuffers,
  		//dt: ext_depth_texture,
  		//thf: oes_texture_half_float,
  		//hf: ext_color_buffer_half_float,
  	}



  	// ROOM INIT
  	let room_list = [];
 	for(let i=0; i<room_config.length; i++) {
 		const r = room_config[0];
 		room_list.push(load_room(r));
 	}
  	console.log(room_list);

  	// PROGRAM INIT
  	let program_data = main_init(gl, room_list);
  	console.log(program_data);


  	/* TEMP DEBUG SETTING */
  	window.gl = gl;
  	window.M = M;
  	window.pd = program_data;

  	window.g = gaussian_kernel_1d;

  	// SETTINGS BUTTONS INIT
  	S.init_settings_handlers(program_data);

  	// EVENT HANDLERS (PLAY AND STOP BUTTONS)
  	{
	  	document.querySelector('#playStop').onclick = function() {
			if(gallery_animation_id === null) {
				play(gl, pd);
				this.children[0].textContent = "STOP";
				this.classList.add('button-active');
			}
			else {
				pause();
				this.children[0].textContent = "PLAY";
				this.classList.remove('button-active');
			}
		}
	}

	// ASYNC ACTIVITIE
	pd.tx.all_images_loaded.finally(() => {
		// RENDERING (FRAME TICK)
  		gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));
	});
}

window.getFPS = function() {
	return frame_count / ((prev_t - time_of_last_tracked_frame) / 1000);
}
window.resetFPS = function() {
	frame_count = 0;
	time_of_last_tracked_frame = prev_t;
}

window.onload = main;