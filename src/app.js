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

/* RENDERING
============ */
function get_projection(gl) {
	const fieldOfView = 45 * Math.PI / 180;   // in radians
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const zNear = 0.1;
	const zFar = 100.0;

	const projection_m = M.mat4.create();
	M.mat4.perspective(
		projection_m,
		fieldOfView,
		aspect,
		zNear,
		zFar);
	return projection_m;
}

function render(gl, shader_data, buffers, t /*TEMP*/) {
	// Set scene constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
	gl.clearDepth(1.0);                 // Clear everything
	gl.enable(gl.DEPTH_TEST);           // Enable depth testing
	gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
	gl.enable(gl.CULL_FACE)
	gl.cullFace(gl.BACK);

	// Clear scene
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Projection matrix init
	let projection_m = get_projection(gl);

	// !!!!!!!!!TEMPORARY TRANSLATION
	let modelview_m = M.mat4.create();
	M.mat4.translate(	modelview_m,     	// destination matrix
             			modelview_m,    	// matrix to translate
             			[-0.0, 0.0, -6.0]); // amount to translate
	let up_v = M.vec3.create();
	M.vec3.set(
		up_v,
		1, 1, 0);
	let rot_m = M.mat4.create();
	M.mat4.fromRotation(
		rot_m,
		t/1000,
		up_v)
	M.mat4.mul(
		modelview_m,
		modelview_m,
		rot_m);

	// CONTEXTUALIZE POSITION INFORMATION
	{
		const num_components = 3;  // pull out 2 values per iteration
		const type = gl.FLOAT;    // the data in the buffer is 32bit floats
		const normalize = false;  // don't normalize
		const stride = 24;         // how many bytes to get from one set of values to the next
		const offset = 0;         // how many bytes inside the buffer to start from
		gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
		gl.vertexAttribPointer(
			shader_data.attribs.vertex_pos,
			num_components,
			type,
			normalize,
			stride,
			offset);
		gl.enableVertexAttribArray(
			shader_data.attribs.vertex_pos);
	}
	// CONTEXTUALIZE NORMAL INFORMATION
	{
		const num_components = 3;  // pull out 2 values per iteration
		const type = gl.FLOAT;    // the data in the buffer is 32bit floats
		const normalize = false;  // don't normalize
		const stride = 24;         // how many bytes to get from one set of values to the next
		const offset = 12;         // how many bytes inside the buffer to start from
		// gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertices);
		gl.vertexAttribPointer(
			shader_data.attribs.normal_dir,
			num_components,
			type,
			normalize,
			stride,
			offset);
		gl.enableVertexAttribArray(
			shader_data.attribs.normal_dir);
	}
	// CONTEXTUALIZE INDEX INFORMATION

	gl.useProgram(shader_data.prog);

	// Set the shader uniforms
	gl.uniformMatrix4fv(
		shader_data.uniforms.projection_m,
		false,
		projection_m);
	gl.uniformMatrix4fv(
		shader_data.uniforms.modelview_m,
		false,
		modelview_m);

	// DRAW
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
	{
		const element_count = cube_p.count;
		const type = gl.UNSIGNED_SHORT;
		const offset = 0;
		gl.drawElements(gl.TRIANGLES, element_count, type, offset);
	}
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