import * as M from './gl-matrix.js';

/* RENDERING
============ */
function get_projection(gl, fov) {
	const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const fovy = (fov/aspect) * Math.PI / 180;   // in radians
	const zNear = 0.1;
	const zFar = 100.0;

	const projection_m = M.mat4.create();
	M.mat4.perspective(
		projection_m,
		fovy,
		aspect,
		zNear,
		zFar);
	return projection_m;
}

function get_view(gl, camera) {

}

function render(gl, pd, t /*TEMP*/) {
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
	const projection_m = get_projection(gl, 90);

	// Model matrix init
	const model_m = M.mat4.create();

	// View matrix init
	const view_m = pd.cam.get_view_matrix();

	// ROOM_LIST RENDERING
	for(let i=0; i<pd.room_list.length; i++) {
		const room = pd.room_list[i];
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
			gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.vertices);
			gl.vertexAttribPointer(
				pd.shader.attribs.vertex_pos,
				num_components,
				type,
				normalize,
				stride,
				offset);
			gl.enableVertexAttribArray(
				pd.shader.attribs.vertex_pos);
		}
		// CONTEXTUALIZE NORMAL INFORMATION
		{
			const num_components = 3;  // pull out 2 values per iteration
			const type = gl.FLOAT;    // the data in the buffer is 32bit floats
			const normalize = false;  // don't normalize
			const stride = 24;         // how many bytes to get from one set of values to the next
			const offset = room.buffer_offset_v*4 + 12;         // how many bytes inside the buffer to start from
			// gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.vertices);
			gl.vertexAttribPointer(
				pd.shader.attribs.normal_dir,
				num_components,
				type,
				normalize,
				stride,
				offset);
			gl.enableVertexAttribArray(
				pd.shader.attribs.normal_dir);
		}
		// CONTEXTUALIZE INDEX INFORMATION

		gl.useProgram(pd.shader.prog);

		// Set the shader uniforms
		gl.uniformMatrix4fv(
			pd.shader.uniforms.projection_m,
			false,
			projection_m);
		gl.uniformMatrix4fv(
			pd.shader.uniforms.view_m,
			false,
			view_m);
		gl.uniformMatrix4fv(
			pd.shader.uniforms.model_m,
			false,
			model_m);

		// DRAW
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.indices);
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