'use strict';

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

function init_buffers(gl) {
	// vertex buffer
	const vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube_p.vertices), gl.STATIC_DRAW);
	// index buffer
	const index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cube_p.indices), gl.STATIC_DRAW);

	return {
		vertices: vertex_buffer,
		indices: index_buffer,
	};
}


/* MAIN INITIALIZATION
====================== */
function main_init(gl) {
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
	const buffer_data = init_buffers(gl);

	return {
		shader: shader_data,
		buffers: buffer_data
	}
}


/* MAIN FUNCTION
================ */
let gallery_animation_id = null;
function frame_tick(gl, program_data) {
	function T(t) {
		render(gl, program_data.shader, program_data.buffers, t);
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

  	// INIT
  	let program_data = main_init(gl);

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