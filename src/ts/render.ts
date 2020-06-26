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

/* SHADOW MAPPING PASS
====================== */
function shadowmap_pass(gl:any, pd:any):void {
	// bind fb
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.shadowmap_pass);

	// set viewport
	gl.viewport(0, 0, 480, 480);

	// use shader
	const shader = pd.shaders.shadowmap_pass;
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0); 
	gl.clearDepth(1.0);                
	gl.enable(gl.DEPTH_TEST);         
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.FRONT); // only render backfaces for shadowmapping
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// SHOULD BE A LOOP IN THE FUTURE, FOR NOW 1 LIGHT
	{	
		const room = pd.room_list[0];
		const light = room.spotlights[0];
	 	
		// Set projection uniform
		gl.uniformMatrix4fv(shader.uniforms.proj_m, false, light.proj_m);

		// Set modelview uniform
		const mv_m:mat4 = light.cam.get_view_matrix();
		gl.uniformMatrix4fv(shader.uniforms.mv_m, false, mv_m);

		// BIND VAO
		gl.bindVertexArray(pd.vaos.room);
		// DRAW
		{
			const element_count :number = room.mesh_count_i;
			const type			:number = gl.UNSIGNED_SHORT;
			const offset 		:number = room.buffer_offset_i;
			gl.drawElements(gl.TRIANGLES, element_count, type, offset);
		}
		// UNBIND VAO
		gl.bindVertexArray(null);
	}

	// reset viewport
	gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);
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
	gl.uniformMatrix4fv(shader.uniforms.proj_m, false, proj_m);

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
		gl.uniformMatrix4fv(shader.uniforms.mv_m, false, mv_m);
		gl.uniformMatrix4fv( shader.uniforms.it_mv_m, false, it_mv_m);

		// UNIFORMS SET
		gl.uniform3fv(shader.uniforms.ambient_c, room.ambient_color);
		gl.uniform1f(shader.uniforms.ambient_i, room.ambient_intensity);

		// BIND VAO
		gl.bindVertexArray(pd.vaos.room);
		// DRAW
		{
			const element_count :number = room.mesh_count_i;
			const type			:number = gl.UNSIGNED_SHORT;
			const offset 		:number = room.buffer_offset_i;
			gl.drawElements(gl.TRIANGLES, element_count, type, offset);
		}
		// UNBIND VAO
		gl.bindVertexArray(null);
	}
}

/* SSAO PASS
==================== */
function ssao_pass(gl:any, pd:any, proj_m:mat4):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.ssao_pass);

	// set viewport
	gl.viewport(0, 0, gl.canvas.clientWidth/2, gl.canvas.clientHeight/2);

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

	// bind vao
	gl.bindVertexArray(pd.vaos.quad);
	// draw
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	// unbind vao
	gl.bindVertexArray(null);

	// reset viewport
	gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);
}

/* SSAO BLUR
==================== */
function ssao_blur(gl:any, pd:any):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.ssao_blur);

	// set viewport
	gl.viewport(0, 0, gl.canvas.clientWidth/2, gl.canvas.clientHeight/2);

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

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// ssao texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.ssao_pass);
	gl.uniform1i(shader.uniforms.ssao_tex, 0);

	// bind vao
	gl.bindVertexArray(pd.vaos.quad);
	// draw
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	// unbind vao
	gl.bindVertexArray(null);

	// reset viewport
	gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);
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
	gl.activeTexture(gl.TEXTURE4);	// shadow atlas texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.shadow_atlas);
	gl.uniform1i(shader.uniforms.shadow_atlas_tex, 4);

	// shadowmap uniform set
	gl.uniform2f(shader.uniforms.shadowmap_dims, 480, 480); // HARDCODED 480X480
	gl.uniform2fv(shader.uniforms.poisson_samples, pd.poisson_samples);
	gl.uniform2fv(shader.uniforms.blocker_samples, pd.blocker_samples);

	// matrix uniform set
	const view_m:mat4 = pd.cam.get_view_matrix();
	const inv_view_m:mat4 = M.mat4.create();
	M.mat4.invert(inv_view_m, view_m);
	const c_view_to_l_screen:mat4 = M.mat4.create();
	M.mat4.mul(c_view_to_l_screen, light.cam.get_view_matrix(), inv_view_m);
	M.mat4.mul(c_view_to_l_screen, light.proj_m, c_view_to_l_screen);
	gl.uniformMatrix4fv(shader.uniforms.camera_view_to_light_screen, false, c_view_to_l_screen);

	// light uniform set
	const v4:vec4 = M.vec4.create();
	M.vec4.set(v4, light.cam.pos[0], light.cam.pos[1], light.cam.pos[2], 1);
	M.vec4.transformMat4(v4, v4, view_m);
	gl.uniform3f(shader.uniforms.light_pos, v4[0], v4[1], v4[2]);
	const light_dir = light.cam.get_look_dir();
	M.vec4.set(v4, light_dir[0], light_dir[1], light_dir[2], 0);
	M.vec4.transformMat4(v4, v4, view_m);
	gl.uniform3f(shader.uniforms.light_dir, v4[0], v4[1], v4[2]);
	gl.uniform3fv(shader.uniforms.light_color, light.color);
	gl.uniform1f(shader.uniforms.light_int, light.intensity);
	gl.uniform1f(shader.uniforms.light_i_angle, light.i_angle);
	gl.uniform1f(shader.uniforms.light_o_angle, light.o_angle);
	gl.uniform1f(shader.uniforms.light_falloff, light.falloff);

	// bind vao
	gl.bindVertexArray(pd.vaos.quad);
	// draw
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	// unbind vao
	gl.bindVertexArray(null);
}

/* QUAD DRAWN GBUFFER COMBINE PASS
================================== */
function quad_deferred_combine(gl:any, pd:any, write_to_frame:boolean):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, write_to_frame ? null : pd.fb.deferred_combine);

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
	gl.activeTexture(gl.TEXTURE3);	// ambient buffer
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.bufs[5]);
	gl.uniform1i(shader.uniforms.ambient_tex, 3);
	gl.activeTexture(gl.TEXTURE4);	// ssao texture
	gl.bindTexture(gl.TEXTURE_2D, pd.settings.ssao.enabled ? pd.tx.ssao_blur : pd.tx.white); // NEED BACKUP FOR SSAO DISABLED
	gl.uniform1i(shader.uniforms.ssao_tex, 4);
	gl.activeTexture(gl.TEXTURE5);	// light texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.light_val);
	gl.uniform1i(shader.uniforms.light_tex, 5);

	// bind vao
	gl.bindVertexArray(pd.vaos.quad);
	// draw
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	// unbind vao
	gl.bindVertexArray(null);
}

/* FXAA PASS
==================== */
function fxaa_pass(gl:any, pd:any):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);//pd.fb.fxaa_pass);

	// use program
	const shader = pd.shaders.fxaa_pass_variants[pd.settings.fxaa.quality_index];
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(0.0, 0.0, 0.0, 1.0);  
	gl.clearDepth(1.0);                 
	gl.disable(gl.DEPTH_TEST);          
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT);

	// texture set
	gl.activeTexture(gl.TEXTURE0);	// ssao texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.screen_tex);
	gl.uniform1i(shader.uniforms.scren_tex, 0);

	// bind vao
	gl.bindVertexArray(pd.vaos.quad);
	// draw
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
	// unbind vao
	gl.bindVertexArray(null);
}

/* FINAL RENDER FUNCTION
======================== */
function render(gl:any, pd:any):void {

	// shadowmap pass
	shadowmap_pass(gl, pd);

	// get projection matrix
	const proj_m:mat4 = get_projection(gl, 90);
	
	// draw scene to gbuffer
	gbuffer_pass(gl, pd, proj_m);

	// ssao passes
	if(pd.settings.ssao.enabled) {
		// ssao pass
		ssao_pass(gl, pd, proj_m)
		// ssao pass
		ssao_blur(gl, pd)
	}

	// spotlight pass
	spotlight_pass(gl, pd, pd.room_list[0].spotlights[0]);

	// combine gbuffer contents on quad
	quad_deferred_combine(gl, pd, !pd.settings.fxaa.enabled);

	// fxaa post-process
	if(pd.settings.fxaa.enabled)
		fxaa_pass(gl, pd);

}

// EXPORTS
// ==============
export { render };