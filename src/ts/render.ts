import * as M from 'gl-matrix';
import { vec3, mat4 } from 'gl-matrix';
import { Room } from './room';

/* RENDERING
============ */
function get_projection(gl:any, fov:number):mat4 {
	const aspect:number = gl.canvas.clientWidth / gl.canvas.clientHeight;
	const fovy	:number = (fov/aspect) * Math.PI / 180;   // in radians
	const zNear	:number = 0.1;
	const zFar	:number = 100.0;

	const projection_m:mat4 = M.mat4.create();
	M.mat4.perspective(
		projection_m,
		fovy,
		aspect,
		zNear,
		zFar);
	return projection_m;
}

/* GBUFFER PASS FOR DEFERRED SHADING
==================================== */
function gbuffer_pass(gl:any, pd:any, proj_m:mat4):void {
	// Bind to deferred fb
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.deferred);

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

	// Set projection uniform
	gl.uniformMatrix4fv(
		pd.shaders.deferred_pass.uniforms.projection_m,
		false,
		proj_m);

	// View matrix init
	const view_m:mat4 = pd.cam.get_view_matrix();

	// ModelView init
	const mv_m 		:mat4 = M.mat4.create();
	const it_mv_m 	:mat4 = M.mat4.create();

	// ROOM_LIST RENDERING
	for(let i:number = 0; i<pd.room_list.length; i++) {
		const room:Room = pd.room_list[i];
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

		// Set modelview uniforms
		gl.uniformMatrix4fv(
			pd.shaders.deferred_pass.uniforms.mv_m,
			false,
			mv_m);
		gl.uniformMatrix4fv(
			pd.shaders.deferred_pass.uniforms.it_mv_m,
			false,
			it_mv_m);

		// CONTEXTUALIZE POSITION INFORMATION
		gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.room.vertices);
		{
			const num_components:number = 3;
			const type 			:number = gl.FLOAT;
			const normalize 	:boolean = false;
			const stride 		:number = 24;
			const offset 		:number = room.buffer_offset_v*4;
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
			const num_components:number = 3;
			const type 			:number = gl.FLOAT;
			const normalize 	:boolean = false;
			const stride 		:number = 24;
			const offset 		:number = room.buffer_offset_v*4 + 12;
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

		// DRAW
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.room.indices);
		{
			const element_count :number = room.wall_count_i;
			const type			:number = gl.UNSIGNED_SHORT;
			const offset 		:number = room.buffer_offset_i;
			gl.drawElements(gl.TRIANGLES, element_count, type, offset);
		}
	}
}

/* SSAO PASS
==================== */
function ssao_pass(gl:any, pd:any, proj_m:mat4):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.ssao);

	// use program
	gl.useProgram(pd.shaders.ssao_pass.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
	gl.clearDepth(1.0);                 // Clear everything
	gl.disable(gl.DEPTH_TEST);           // Enable depth testing
	gl.enable(gl.CULL_FACE)
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// vertex attrib for positions (texcoords derived from positions)
	gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
	gl.vertexAttribPointer(
		pd.shaders.ssao_pass.attribs.vertex_pos,
		2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(
		pd.shaders.ssao_pass.attribs.vertex_pos);

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// position buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[1]);
	gl.uniform1i(pd.shaders.ssao_pass.uniforms.pos_tex, 0);
	gl.activeTexture(gl.TEXTURE1);	// normal buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[2]);
	gl.uniform1i(pd.shaders.ssao_pass.uniforms.norm_tex, 1);
	gl.activeTexture(gl.TEXTURE2);	// noise texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.rot_noise);
	gl.uniform1i(pd.shaders.ssao_pass.uniforms.noise_tex, 2);

	// uniform set
	gl.uniform3fv(
		pd.shaders.ssao_pass.uniforms.samples_a,
		pd.ssao_kernel);
	gl.uniformMatrix4fv(
		pd.shaders.ssao_pass.uniforms.proj_m,
		false,
		proj_m);

	// draw
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.quad.indices)
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/* QUAD DRAWN GBUFFER COMBINE PASS
================================== */
function quad_deferred_combine(gl:any, pd:any):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	// set program
	gl.useProgram(pd.shaders.deferred_combine.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
	gl.clearDepth(1.0);                 // Clear everything
	gl.disable(gl.DEPTH_TEST);           // Enable depth testing
	gl.enable(gl.CULL_FACE)
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// vertex attrib for positions (texcoords derived from positions)
	gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
	gl.vertexAttribPointer(
		pd.shaders.deferred_combine.attribs.vertex_pos,
		2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(
		pd.shaders.deferred_combine.attribs.vertex_pos);


	// uniform set
	gl.uniformMatrix4fv(
		pd.shaders.deferred_combine.uniforms.view_m,
		false,
		pd.cam.get_view_matrix());

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// position buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[1]);
	gl.uniform1i(pd.shaders.deferred_combine.uniforms.pos_tex, 0);
	gl.activeTexture(gl.TEXTURE1);	// normal buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[2]);
	gl.uniform1i(pd.shaders.deferred_combine.uniforms.norm_tex, 1);
	gl.activeTexture(gl.TEXTURE2);	// color buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[3]);
	gl.uniform1i(pd.shaders.deferred_combine.uniforms.color_tex, 2);

	// draw
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.quad.indices)
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/* FINAL RENDER FUNCTION
======================== */
function render(gl:any, pd:any):void {

	// get projection matrix
	const proj_m:mat4 = get_projection(gl, 90);
	
	// PASS 1: draw scene to gbuffer
	gbuffer_pass(gl, pd, proj_m);

	// PASS 2: ssao pass
	ssao_pass(gl, pd, proj_m)

	// PASS 2: combine gbuffer contents on quad
	quad_deferred_combine(gl, pd);

}

// EXPORTS
// ==============
export { render };