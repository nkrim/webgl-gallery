import * as M from 'gl-matrix';
import { vec3, vec4, mat4 } from 'gl-matrix';
import { Room } from './room';
import { Spotlight } from './spotlight';

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
	const shader = pd.shaders.deferred_pass;
	gl.useProgram(shader.prog);

	// Set scene constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clearDepth(1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);

	// Clear scene
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Set projection uniform
	gl.uniformMatrix4fv(
		shader.uniforms.projection_m,
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
			shader.uniforms.mv_m,
			false,
			mv_m);
		gl.uniformMatrix4fv(
			shader.uniforms.it_mv_m,
			false,
			it_mv_m);

		// CONTEXTUALIZE POSITION INFORMATION
		const full_stride = 44; // 12+12+12+8
		gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.room.vertices);
		{
			const attribute:		number = shader.attribs.vertex_pos;
			const num_components:	number = 3;
			const type:				number = gl.FLOAT;
			const normalize:		boolean = false;
			const stride:			number = full_stride;
			const offset:			number = room.buffer_offset_v*4;
			gl.vertexAttribPointer(attribute, num_components, type, normalize, stride, offset);
			gl.enableVertexAttribArray(attribute);
		}
		// CONTEXTUALIZE NORMAL INFORMATION
		{
			const attribute:		number = shader.attribs.normal_dir;
			const num_components:	number = 3;
			const type:				number = gl.FLOAT;
			const normalize:		boolean = false;
			const stride:			number = full_stride;
			const offset:			number = room.buffer_offset_v*4 + 12;
			// gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.vertices);
			gl.vertexAttribPointer(attribute, num_components, type, normalize, stride, offset);
			gl.enableVertexAttribArray(attribute);
		}
		// CONTEXTUALIZE ALBEDO INFORMATION
		{
			const attribute:		number = shader.attribs.albedo;
			const num_components:	number = 3;
			const type:				number = gl.FLOAT;
			const normalize:		boolean = false;
			const stride:			number = full_stride;
			const offset:			number = room.buffer_offset_v*4 + 24;
			// gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.vertices);
			gl.vertexAttribPointer(attribute, num_components, type, normalize, stride, offset);
			gl.enableVertexAttribArray(attribute);
		}
		// CONTEXTUALIZE ROUGH/METAL INFORMATION
		{
			const attribute:		number = shader.attribs.rough_metal;
			const num_components:	number = 2;
			const type:				number = gl.FLOAT;
			const normalize:		boolean = false;
			const stride:			number = full_stride;
			const offset:			number = room.buffer_offset_v*4 + 36;
			// gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.vertices);
			gl.vertexAttribPointer(attribute, num_components, type, normalize, stride, offset);
			gl.enableVertexAttribArray(attribute);
		}

		// DRAW
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.room.indices);
		{
			const element_count :number = room.mesh_count_i;
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
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.ssao_pass);

	// use program
	const shader = pd.shaders.ssao_pass;
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0); 
	gl.clearDepth(1.0);                
	gl.disable(gl.DEPTH_TEST);         
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// vertex attrib for positions (texcoords derived from positions)
	gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
	gl.vertexAttribPointer(
		shader.attribs.vertex_pos,
		2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attribs.vertex_pos);

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// position buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[1]);
	gl.uniform1i(shader.uniforms.pos_tex, 0);
	gl.activeTexture(gl.TEXTURE1);	// normal buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[2]);
	gl.uniform1i(shader.uniforms.norm_tex, 1);
	gl.activeTexture(gl.TEXTURE2);	// noise texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.rot_noise);
	gl.uniform1i(shader.uniforms.noise_tex, 2);

	// uniform set
	gl.uniform3fv(
		shader.uniforms.samples_a,
		pd.ssao_kernel);
	gl.uniformMatrix4fv(
		shader.uniforms.proj_m,
		false,
		proj_m);

	// draw
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.quad.indices)
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/* SSAO BLUR
==================== */
function ssao_blur(gl:any, pd:any):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.ssao_blur);

	// use program
	const shader = pd.shaders.ssao_blur;
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  
	gl.clearDepth(1.0);                 
	gl.disable(gl.DEPTH_TEST);          
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// vertex attrib for positions (texcoords derived from positions)
	gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
	gl.vertexAttribPointer(
		shader.attribs.vertex_pos,
		2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attribs.vertex_pos);

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// ssao texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.ssao_pass);
	gl.uniform1i(shader.uniforms.ssao_tex, 0);

	// draw
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.quad.indices)
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/* SPOTLIGHT INT PASS
===================== */
function spotlight_pass(gl:any, pd:any, light:Spotlight):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.light_val);

	// use program
	const shader = pd.shaders.spotlight_pass;
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  
	gl.clearDepth(1.0);                 
	gl.disable(gl.DEPTH_TEST);          
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// vertex attrib for positions (texcoords derived from positions)
	gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
	gl.vertexAttribPointer(
		shader.attribs.vertex_pos,
		2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attribs.vertex_pos);

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// position buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[1]);
	gl.uniform1i(shader.uniforms.pos_tex, 0);
	gl.activeTexture(gl.TEXTURE1);	// normal buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[2]);
	gl.uniform1i(shader.uniforms.norm_tex, 1);
	gl.activeTexture(gl.TEXTURE2);	// albedo buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[3]);
	gl.uniform1i(shader.uniforms.albedo_tex, 2);
	gl.activeTexture(gl.TEXTURE3);	// rough/metal buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[4]);
	gl.uniform1i(shader.uniforms.rough_metal_tex, 3);

	// uniform set
	const view_m:mat4 = pd.cam.get_view_matrix();
	const v4:vec4 = M.vec4.create();
	M.vec4.set(v4, light.pos[0], light.pos[1], light.pos[2], 1);
	M.vec4.transformMat4(v4, v4, view_m);
	gl.uniform3f(shader.uniforms.light_pos, v4[0], v4[1], v4[2]);
	M.vec4.set(v4, light.dir[0], light.dir[1], light.dir[2], 0);
	M.vec4.transformMat4(v4, v4, view_m);
	gl.uniform3f(shader.uniforms.light_dir, v4[0], v4[1], v4[2]);
	gl.uniform1f(shader.uniforms.light_i_angle, light.i_angle);
	gl.uniform1f(shader.uniforms.light_o_angle, light.o_angle);
	gl.uniform1f(shader.uniforms.light_falloff, light.falloff);

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
	const shader = pd.shaders.deferred_combine;
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
	gl.clearDepth(1.0);                 // Clear everything
	gl.disable(gl.DEPTH_TEST);           // Enable depth testing
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// vertex attrib for positions (texcoords derived from positions)
	gl.bindBuffer(gl.ARRAY_BUFFER, pd.buffers.quad.vertices);
	gl.vertexAttribPointer(
		shader.attribs.vertex_pos,
		2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(shader.attribs.vertex_pos);

	// uniform set
	gl.uniformMatrix4fv(
		shader.uniforms.view_m,
		false,
		pd.cam.get_view_matrix());

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// position buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[1]);
	gl.uniform1i(shader.uniforms.pos_tex, 0);
	gl.activeTexture(gl.TEXTURE1);	// normal buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[2]);
	gl.uniform1i(shader.uniforms.norm_tex, 1);
	gl.activeTexture(gl.TEXTURE2);	// color buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[3]);
	gl.uniform1i(shader.uniforms.color_tex, 2);
	gl.activeTexture(gl.TEXTURE3);	// ssao texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.ssao_blur);
	gl.uniform1i(shader.uniforms.ssao_tex, 3);
	gl.activeTexture(gl.TEXTURE4);	// light texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.light_val);
	gl.uniform1i(shader.uniforms.light_tex, 4);

	// draw
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pd.buffers.quad.indices)
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

/* FINAL RENDER FUNCTION
======================== */
function render(gl:any, pd:any):void {

	// get projection matrix
	const proj_m:mat4 = get_projection(gl, 90);
	
	// draw scene to gbuffer
	gbuffer_pass(gl, pd, proj_m);

	// ssao pass
	ssao_pass(gl, pd, proj_m)

	// ssao pass
	ssao_blur(gl, pd)

	// spotlight pass
	spotlight_pass(gl, pd, pd.room_list[0].spotlights[0]);

	// combine gbuffer contents on quad
	quad_deferred_combine(gl, pd);

}

// EXPORTS
// ==============
export { render };