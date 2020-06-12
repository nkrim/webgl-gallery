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
	// Bind to deferred fb
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.deferred_fb);

	// USE DEFERRED PASS SHADER
	gl.useProgram(pd.shaders.deferred_pass.prog);

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

	// View matrix init
	const view_m = pd.cam.get_view_matrix();

	// ModelView init
	const mv_m = M.mat4.create();
	const it_mv_m = M.mat4.create();

	// ROOM_LIST RENDERING
	for(let i=0; i<pd.room_list.length; i++) {
		const room = pd.room_list[i];
		if(room.buffer_offset_v < 0 || room.buffer_offset_i < 0) {
			console.warn(`render: room [${i}] has invalid buffer offset : v[${room.buffer_offset_v}] i[${room.buffer_offset_i}]`);
			continue;
		}

		// ModelView (and inverse-transpose) construction
		M.mat4.identity(mv_m);
		M.mat4.mul(mv_m, view_m, mv_m /*replace with model matrix*/);
		M.mat4.identity(it_mv_m);
		M.mat4.invert(it_mv_m, mv_m);
		M.mat4.transpose(it_mv_m, it_mv_m);

		// CONTEXTUALIZE POSITION INFORMATION
		gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.room.vertices);
		{
			const num_components = 3;  // pull out 3 values per iteration
			const type = gl.FLOAT;    // the data in the buffer is 32bit floats
			const normalize = false;  // don't normalize
			const stride = 24;         // how many bytes to get from one set of values to the next
			const offset = room.buffer_offset_v*4;         // how many bytes inside the buffer to start from
			gl.vertexAttribPointer(
				pd.shaders.deferred_pass.attribs.vertex_pos,
				num_components,
				type,
				normalize,
				stride,
				offset);
			gl.enableVertexAttribArray(
				pd.shaders.deferred_pass.attribs.vertex_pos);
		}
		// CONTEXTUALIZE NORMAL INFORMATION
		{
			const num_components = 3;  // pull out 3 values per iteration
			const type = gl.FLOAT;    // the data in the buffer is 32bit floats
			const normalize = false;  // don't normalize
			const stride = 24;         // how many bytes to get from one set of values to the next
			const offset = room.buffer_offset_v*4 + 12;         // how many bytes inside the buffer to start from
			// gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.vertices);
			gl.vertexAttribPointer(
				pd.shaders.deferred_pass.attribs.normal_dir,
				num_components,
				type,
				normalize,
				stride,
				offset);
			gl.enableVertexAttribArray(
				pd.shaders.deferred_pass.attribs.normal_dir);
		}

		// Set the shader uniforms
		gl.uniformMatrix4fv(
			pd.shaders.deferred_pass.uniforms.projection_m,
			false,
			projection_m);
		gl.uniformMatrix4fv(
			pd.shaders.deferred_pass.uniforms.mv_m,
			false,
			mv_m);
		gl.uniformMatrix4fv(
			pd.shaders.deferred_pass.uniforms.it_mv_m,
			false,
			it_mv_m);


		// DRAW
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.room.indices);
		{
			const element_count = room.wall_count_i;
			const type = gl.UNSIGNED_SHORT;
			const offset = room.buffer_offset_i;
			gl.drawElements(gl.TRIANGLES, element_count, type, offset);
		}

		// DRAW QUAD
		// set program
		gl.useProgram(pd.shaders.deferred_combine.prog);
		// set fbo
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		// clear constants
		gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
		gl.clearDepth(1.0);                 // Clear everything
		gl.disable(gl.DEPTH_TEST);           // Enable depth testing
		gl.enable(gl.CULL_FACE)
		gl.cullFace(gl.BACK);
		// clear
		gl.clear(gl.COLOR_BUFFER_BIT);
		// vertex attrib
		gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
		gl.vertexAttribPointer(
			pd.shaders.deferred_combine.attribs.vertex_pos,
			2, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(
			pd.shaders.deferred_pass.attribs.vertex_pos);
		// uniform set
		gl.uniformMatrix4fv(
			pd.shaders.deferred_combine.uniforms.inv_view_m,
			false,
			view_m);
		// texture set
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[1]);
		gl.uniform1i(pd.shaders.deferred_combine.uniforms.pos_tex, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[2]);
		gl.uniform1i(pd.shaders.deferred_combine.uniforms.norm_tex, 1);
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[3]);
		gl.uniform1i(pd.shaders.deferred_combine.uniforms.color_tex, 2);
		// draw
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.quad.indices)
		{
			const element_count = 6;
			const type = gl.UNSIGNED_SHORT;
			const offset = 0;
			gl.drawElements(gl.TRIANGLES, element_count, type, offset);
		}


	}
}

// EXPORTS
// ==============
export { render };