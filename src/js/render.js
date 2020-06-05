import * as M from './gl-matrix.js';

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

function render(gl, shader_data, buffers, room_list /*TEMP*/, t /*TEMP*/) {
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


	// ROOM_LIST RENDERING
	for(let i=0; i<room_list.length; i++) {
		const room = room_list[i];
		if(room.buffer_offset_v < 0 || room.buffer_offset_i < 0) {
			console.warn(`render: room [${i}] has invalid buffer offset : v[${room.buffer_offset_v}] i[${room.buffer_offset_i}]`);
			continue;
		}

		// CONTEXTUALIZE POSITION INFORMATION
		{
			const num_components = 3;  // pull out 2 values per iteration
			const type = gl.FLOAT;    // the data in the buffer is 32bit floats
			const normalize = false;  // don't normalize
			const stride = 24;         // how many bytes to get from one set of values to the next
			const offset = room.buffer_offset_v*4;         // how many bytes inside the buffer to start from
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
			const offset = room.buffer_offset_v*4 + 12;         // how many bytes inside the buffer to start from
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
			const element_count = room.wall_count_i;
			const type = gl.UNSIGNED_SHORT;
			const offset = room.buffer_offset_i;
			gl.drawElements(gl.TRIANGLES, element_count, type, offset);
		}
	}
}

// EXPORTS
// ==============
export { render };