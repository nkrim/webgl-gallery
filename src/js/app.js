import * as R from '../ts/render.ts';
import * as ROOM from '../ts/room.ts';
import { Camera } from '../ts/camera.ts';
import * as INPUT from '../ts/input.ts';
import { lerp, interlace_n, EPSILON } from '../ts/utils.ts';
import * as S from '../ts/settings.ts';
import * as M from './gl-matrix.js';
import { load_room, room_config } from './room-config.js';
// Shaders
// import { default_shader_v, default_shader_f } from './shaders/default_shader.js';
import { deferred_pass_l, deferred_pass_v, deferred_pass_f } from '../shaders/deferred_pass.js';
import { deferred_combine_l, deferred_combine_v, deferred_combine_f } from '../shaders/deferred_combine.js';
import { ssao_pass_l, ssao_pass_v, gen_ssao_pass_f, SSAO_KERNEL_SIZE } from '../shaders/ssao_pass.js';
import { ssao_blur_l, ssao_blur_v, gen_ssao_blur_f } from '../shaders/ssao_blur.js';
import { spotlight_pass_l, spotlight_pass_v, gen_spotlight_pass_f, 
		PCSS_BLOCKER_GRID_SIZE, PCSS_POISSON_SAMPLE_COUNT } from '../shaders/spotlight_pass.js';
import { fxaa_pass_l, fxaa_pass_v, gen_fxaa_pass_f, FXAA_QUALITY_SETTINGS } from '../shaders/fxaa_pass.ts';
import { shadowmap_pass_l, shadowmap_pass_v, shadowmap_pass_f } from '../shaders/shadowmap_pass.js';

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

export const attribute_locs = {
	position: 0,
	normal: 1,
	albedo: 2,
	rough_metal: 3,
}
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

	return {
		quad: quad_vao,
		room: room_vao,
	};
}

function gen_screen_color_texture(gl, filter_function, dimensions) {
	if(dimensions == undefined) {
		dimensions = M.vec2.create();
		M.vec2.set(dimensions, gl.canvas.clientWidth, gl.canvas.clientHeight);
	}
	const tx = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tx);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter_function);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter_function);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	const level = 0;
	const internalFormat = gl.RGBA16F;
	const width = dimensions[0];
	const height = dimensions[1];
	const border = 0;
	const srcFormat = gl.RGBA;
	const srcType = gl.FLOAT;
	const pixel = null;  // empty
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
            width, height, border, srcFormat, srcType, pixel);
	return tx;
}
function gen_screen_depth_texture(gl, filter_function, dimensions) {
	if(dimensions == undefined) {
		dimensions = M.vec2.create();
		M.vec2.set(dimensions, gl.canvas.clientWidth, gl.canvas.clientHeight);
	}
	const tx = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tx);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter_function);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter_function);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
	const level = 0;
	const internalFormat = gl.DEPTH_COMPONENT16;
	const width = dimensions[0];
	const height = dimensions[1];
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
	5: gbuffer ambient light
*/
function init_textures(gl) {
	// init tx_obj
	const tx_obj = {};
	const dims = M.vec2.create();

	// deferred depth attachment
	tx_obj.depth = gen_screen_depth_texture(gl, gl.NEAREST);
	// gbuffer attachments
	tx_obj.bufs = []
	for(let i=0; i<6; i++) {
		tx_obj.bufs.push(gen_screen_color_texture(gl, gl.LINEAR));
	}
	// ssao texture
	M.vec2.set(dims, gl.canvas.clientWidth/2, gl.canvas.clientHeight/2);
	tx_obj.ssao_pass = gen_screen_color_texture(gl, gl.NEAREST, dims);
	tx_obj.ssao_blur = gen_screen_color_texture(gl, gl.LINEAR, dims);
	// shadow atlas
	tx_obj.shadow_atlas = {};
	tx_obj.shadow_atlas.dims = M.vec2.create(); M.vec2.set(tx_obj.shadow_atlas.dims, 960, 960);
	tx_obj.shadow_atlas.depth_tex = gen_screen_depth_texture(gl, gl.LINEAR, tx_obj.shadow_atlas.dims);
	tx_obj.shadow_atlas.screen_tex = gen_screen_color_texture(gl, gl.LINEAR, tx_obj.shadow_atlas.dims);
	// light accumulation buffer
	tx_obj.light_val = gen_screen_color_texture(gl, gl.LINEAR);
	// screen write texture
	tx_obj.screen_tex = gen_screen_color_texture(gl, gl.LINEAR);

	// default white texture (for when effects are turned off)
	{ 	const tx = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tx);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 1, 1, 0, gl.RGBA, gl.FLOAT, new Float32Array([1,1,1,1])); 
		tx_obj.white = tx;
	}


	return tx_obj;
}

/* Framebuffer Initializations
------------------------------ */
function init_deferred_framebuffer(gl, tx) {
	const fb = gl.createFramebuffer();
	// Bind GBuffer textures
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tx.depth, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx.bufs[0], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tx.bufs[1], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, tx.bufs[2], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT3, gl.TEXTURE_2D, tx.bufs[3], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT4, gl.TEXTURE_2D, tx.bufs[4], 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT5, gl.TEXTURE_2D, tx.bufs[5], 0);

	// DRAW BUFFERS
	gl.drawBuffers([
		gl.COLOR_ATTACHMENT0, 
		gl.COLOR_ATTACHMENT1, 
		gl.COLOR_ATTACHMENT2,
		gl.COLOR_ATTACHMENT3,
		gl.COLOR_ATTACHMENT4,
		gl.COLOR_ATTACHMENT5,
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
		const internalFormat = gl.RGB16F;
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

	// SHADER INIT
	let shaders = {
		shadowmap_pass: 	init_shader_program(gl, shadowmap_pass_v, shadowmap_pass_f, shadowmap_pass_l),
		deferred_pass: 		init_shader_program(gl, deferred_pass_v, deferred_pass_f, deferred_pass_l),
		deferred_combine: 	init_shader_program(gl, deferred_combine_v, deferred_combine_f, deferred_combine_l),
		ssao_pass: 			init_shader_program(gl, ssao_pass_v, 
								gen_ssao_pass_f(gl.canvas.clientWidth/2, gl.canvas.clientHeight/2), ssao_pass_l),
		ssao_blur: 			init_shader_program(gl, ssao_blur_v, 
								gen_ssao_blur_f(gl.canvas.clientWidth/2, gl.canvas.clientHeight/2), ssao_blur_l),
		spotlight_pass: 	init_shader_program(gl, spotlight_pass_v, gen_spotlight_pass_f(), spotlight_pass_l),
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
  	M.vec3.set(cam_pos, 0, 2, 8);
  	const cam = new Camera(cam_pos, 0, 0);

  	// INIT TEXTURES
  	const tx = init_textures(gl);

  	// FRAMEBUFFER INIT
  	const fb_obj = {
  		shadowmap_pass: 	init_shadowmapping_framebuffer(gl, tx.shadow_atlas.depth_tex, tx.shadow_atlas.screen_tex),
		deferred: 			init_deferred_framebuffer(gl, tx),
		ssao_pass: 			init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.ssao_pass),
		ssao_blur: 			init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.ssao_blur),
		light_val: 			init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.light_val),
		deferred_combine: 	init_standard_write_framebuffer(gl, gl.COLOR_ATTACHMENT0, tx.screen_tex),
	};

  	// SSAO DATA INIT
  	const ssao_sample_kernel = gen_ssao_kernel_and_noise(gl, tx);

  	// PCSS BLOCKER SEARCH GRID
  	const pcss_blocker_samples = gen_pcss_blocker_samples(PCSS_BLOCKER_GRID_SIZE);
  	// DEBUG
  	if(true) {
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
  	}

  	// POISSON DISC SAMPLES
  	const pcss_poisson_samples = gen_poisson_disc_samples(PCSS_POISSON_SAMPLE_COUNT, PCSS_POISSON_SAMPLE_COUNT/2);
  	// DEBUG
  	if(true) {
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
  	}

	return {
		shaders: shaders,
		vaos: vaos,
		room_list: room_list,
		cam: cam,
		tx: tx,
		fb: fb_obj,
		ssao_kernel: ssao_sample_kernel,
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
  	}
  	const ext_oesfloat_linear = gl.getExtension('OES_texture_float_linear');
  	if(!ext_oesfloat_linear) {
  		alert('Unsupported WebGL extension OES_texture_float_linear, please try another updated browser (Chrome, Firefox).');
  		return;
  	}*/
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

  	// RENDERING (FRAME TICK)
  	gallery_animation_id = requestAnimationFrame(frame_tick(gl, program_data));

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
}

window.getFPS = function() {
	return frame_count / ((prev_t - time_of_last_tracked_frame) / 1000);
}
window.resetFPS = function() {
	frame_count = 0;
	time_of_last_tracked_frame = prev_t;
}

window.onload = main;