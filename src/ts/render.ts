import * as M from 'gl-matrix';
import { vec2, vec3, vec4, mat4, quat } from 'gl-matrix';
import { Room } from './room';
import { Spotlight } from './spotlight';
import { Model } from './model';
import { mesh_buffer_info } from './mesh';

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
function shadowmap_pass(gl:any, pd:any, room:Room):void {
	// bind fb
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.shadowmap_pass);

	// use shader
	const shader = pd.shaders.shadowmap_pass;
	gl.useProgram(shader.prog);

	// clear constants
	gl.clearColor(1.0, 1.0, 1.0, 1.0); 
	gl.clearDepth(1.0);                
	gl.enable(gl.DEPTH_TEST);         
	gl.enable(gl.CULL_FACE);
	// gl.cullFace(gl.FRONT); // only render backfaces for shadowmapping
	gl.cullFace(gl.BACK);
	// clear
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// init player_model matrix
	const player_quat:quat = M.quat.create(); M.quat.rotateY(player_quat, player_quat, pd.cam.yaw);
	const player_trans:vec3 = M.vec3.create(); M.vec3.add(player_trans, pd.cam.pos, [0,-0.5,0]);
	const player_scale:vec3 = M.vec3.create(); M.vec3.set(player_scale, 0.5, 1.5, 0.5);
	const player_model_m:mat4 = M.mat4.create();
	M.mat4.fromRotationTranslationScale(player_model_m, player_quat, player_trans, player_scale);

	// SHOULD BE A LOOP IN THE FUTURE, FOR NOW 1 LIGHT
	for(let i=0; i<room.spotlights.length; i++) {	
		// fetch light
		const light = room.spotlights[i];

		// set viewport
		const vp_offset_x = pd.tx.shadow_atlas.map_dims[0] * (i%pd.tx.shadow_atlas.atlas_size);
		const vp_offset_y = pd.tx.shadow_atlas.map_dims[1] * Math.floor(i/pd.tx.shadow_atlas.atlas_size);
		gl.viewport(vp_offset_x, vp_offset_y, pd.tx.shadow_atlas.map_dims[0], pd.tx.shadow_atlas.map_dims[1]);
	 	
		// Set projection uniform
		gl.uniformMatrix4fv(shader.uniforms.proj_m, false, light.proj_m);

		// Set modelview uniform
		const view_m:mat4 = light.cam.get_view_matrix();
		const mv_m:mat4 = M.mat4.create(); M.mat4.copy(mv_m, view_m);
		gl.uniformMatrix4fv(shader.uniforms.mv_m, false, mv_m);

		// set light uniforms
		gl.uniform1f(shader.uniforms.znear, light.zplanes[0]);
		gl.uniform1f(shader.uniforms.zfar, light.zplanes[1]);

		// DRAW ROOM		
		gl.bindVertexArray(pd.vaos.room);		// BIND VAO
		gl.drawElements(gl.TRIANGLES, room.mesh_count_i, gl.UNSIGNED_SHORT, room.buffer_offset_i);
		gl.bindVertexArray(null);				// UNBIND VAO

		// DRAW MODELS
		gl.bindVertexArray(pd.vaos.mesh);		// BIND VAO
		for(let j=0; j<room.models.length; j++) {
			const model = room.models[j];
			M.mat4.mul(mv_m, light.cam.get_view_matrix(), model.get_model_matrix());
			gl.uniformMatrix4fv(shader.uniforms.mv_m, false, mv_m);
			const buffer_info = mesh_buffer_info.get(model.mesh_id);
			gl.drawElements(gl.TRIANGLES, buffer_info[0], gl.UNSIGNED_SHORT, buffer_info[1]);
		}
		gl.bindVertexArray(null);				// UNBIND VAO

		if(pd.settings.player.model) {
			const player_mv_m = M.mat4.create();
			// setup player mvm
			M.mat4.mul(player_mv_m, light.cam.get_view_matrix(), player_model_m);
			gl.uniformMatrix4fv(shader.uniforms.mv_m, false, player_mv_m);
			// DRAW PLAYER
			gl.bindVertexArray(pd.vaos.player);		// BIND VAO
			gl.drawElements(gl.TRIANGLES, 24, gl.UNSIGNED_SHORT, 0);
			gl.bindVertexArray(null);				// UNBIND VAO
		}
	}

	// reset viewport
	gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);
}

/* SUMMED AREA PASS
=================== */
function summedarea_pass(gl:any, pd:any, room:Room):void {
	// set rendering constants           
	gl.disable(gl.DEPTH_TEST);         
	gl.enable(gl.CULL_FACE);
	gl.cullFace(gl.BACK);

	// easy reference constants
	const tex_a = pd.tx.shadow_atlas.savsm_a;
	const tex_b = pd.tx.shadow_atlas.savsm_b;

	// X PASSES
	// --------
	// use shader
	let shader:any = pd.shaders.summedarea_x_pass;
	gl.useProgram(shader.prog);
	
	// perform recursive iters
	const x_iters:number = Math.ceil(Math.log2(pd.tx.shadow_atlas.map_dims[0]));
	let writing_tex_a:boolean = true; 
	for(let i=0; i<x_iters; i++) {
		// bind fb
		gl.bindFramebuffer(gl.FRAMEBUFFER, writing_tex_a ? pd.fb.summedarea_a : pd.fb.summedarea_b);
		// set input texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, i === 0 
			? pd.tx.shadow_atlas.linear_tex
			: (writing_tex_a ? tex_b : tex_a));
		gl.uniform1i(shader.uniforms.in_tex, 0);
		// set iter uniforms
		gl.uniform1i(shader.uniforms.iter, i);

		// loop over lights
		for(let light_index=0; light_index<room.spotlights.length; light_index++) {	
			// set viewport
			const vp_offset_x = pd.tx.shadow_atlas.map_dims[0] * (light_index%pd.tx.shadow_atlas.atlas_size);
			const vp_offset_y = pd.tx.shadow_atlas.map_dims[1] * Math.floor(light_index/pd.tx.shadow_atlas.atlas_size);
			gl.viewport(vp_offset_x, vp_offset_y, pd.tx.shadow_atlas.map_dims[0], pd.tx.shadow_atlas.map_dims[1]);

			// set atlas info 
			gl.uniform3f(shader.uniforms.atlas_info,  
				light_index % pd.tx.shadow_atlas.atlas_size,
				Math.floor(light_index / pd.tx.shadow_atlas.atlas_size),
				pd.tx.shadow_atlas.atlas_size);
			gl.uniform2fv(shader.uniforms.tex_dims, pd.tx.shadow_atlas.map_dims);

			// bind vao
			gl.bindVertexArray(pd.vaos.quad);
			// draw
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
			// unbind vao
			gl.bindVertexArray(null);
		}

		// flip buffers
		writing_tex_a = !writing_tex_a;
	}

	// Y PASSES
	// --------
	// use shader
	shader = pd.shaders.summedarea_y_pass;
	gl.useProgram(shader.prog);
	// perform recursive iters
	const y_iters:number = Math.ceil(Math.log2(pd.tx.shadow_atlas.map_dims[1]));
	for(let i=0; i<y_iters; i++) {
		// bind fb
		gl.bindFramebuffer(gl.FRAMEBUFFER, writing_tex_a ? pd.fb.summedarea_a : pd.fb.summedarea_b);
		// set input texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, writing_tex_a ? tex_b : tex_a);
		gl.uniform1i(shader.uniforms.in_tex, 0);
		// set iter uniforms
		gl.uniform1i(shader.uniforms.iter, i);

		// loop over lights
		for(let light_index=0; light_index<room.spotlights.length; light_index++) {	
			// set viewport
			const vp_offset_x = pd.tx.shadow_atlas.map_dims[0] * (light_index%pd.tx.shadow_atlas.atlas_size);
			const vp_offset_y = pd.tx.shadow_atlas.map_dims[1] * Math.floor(light_index/pd.tx.shadow_atlas.atlas_size);
			gl.viewport(vp_offset_x, vp_offset_y, pd.tx.shadow_atlas.map_dims[0], pd.tx.shadow_atlas.map_dims[1]);

			// set atlas info 
			gl.uniform3f(shader.uniforms.atlas_info,  
				light_index % pd.tx.shadow_atlas.atlas_size,
				Math.floor(light_index / pd.tx.shadow_atlas.atlas_size),
				pd.tx.shadow_atlas.atlas_size);
			gl.uniform2fv(shader.uniforms.tex_dims, pd.tx.shadow_atlas.map_dims);

			// bind vao
			gl.bindVertexArray(pd.vaos.quad);
			// draw
			gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
			// unbind vao
			gl.bindVertexArray(null);
		}

		// flip buffers
		writing_tex_a = !writing_tex_a;
	}

	// reset viewport
	gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight);

	// set active shadowatlas
	// reverse of writing_tex_a since it flips after last iter
	pd.tx.shadow_atlas.screen_tex_active = writing_tex_a ? tex_b : tex_a;
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
		//M.mat4.identity(mv_m);
		M.mat4.copy(mv_m, view_m/*replace with model matrix*/);
		//M.mat4.identity(it_mv_m);
		M.mat4.invert(it_mv_m, mv_m);
		//M.mat4.transpose(it_mv_m, it_mv_m);

		// Set modelview uniforms
		gl.uniformMatrix4fv(shader.uniforms.mv_m, false, mv_m);
		gl.uniformMatrix4fv(shader.uniforms.it_mv_m, true, it_mv_m);

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

		// BIND VAO
		gl.bindVertexArray(pd.vaos.mesh);
		// DRAW MODELS
		for(let j=0; j<room.models.length; j++) {
			const model:Model = room.models[j];
			const buffer_info = mesh_buffer_info.get(model.mesh_id);

			M.mat4.mul(mv_m, view_m, model.get_model_matrix());
			M.mat4.invert(it_mv_m, mv_m);

			gl.uniformMatrix4fv(shader.uniforms.mv_m, false, mv_m);
			gl.uniformMatrix4fv(shader.uniforms.it_mv_m, true, it_mv_m);
			gl.drawElements(gl.TRIANGLES, buffer_info[0], gl.UNSIGNED_SHORT, buffer_info[1]);
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
	// gl.viewport(0, 0, gl.canvas.clientWidth/2, gl.canvas.clientHeight/2);

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
function ssao_blur(gl:any, pd:any, t3:vec3):void {
	// set fbo
	gl.bindFramebuffer(gl.FRAMEBUFFER, pd.fb.ssao_blur);

	// set viewport
	// gl.viewport(0, 0, gl.canvas.clientWidth/2, gl.canvas.clientHeight/2);

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
	gl.activeTexture(gl.TEXTURE1);	// blue noise texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.img.blue_noise);
	gl.uniform1i(shader.uniforms.blue_noise_tex, 1);

	// uniform set
	gl.uniform3fv(shader.uniforms.time, t3);

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
function spotlight_pass(gl:any, pd:any, room:Room, t3:vec3):void {
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
	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.ONE, gl.ONE);
	gl.blendColor(1,1,1,1);
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
	gl.activeTexture(gl.TEXTURE4);	// shadow atlas linear depth texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.shadow_atlas.linear_tex);
	gl.uniform1i(shader.uniforms.shadow_atlas_linear_tex, 4);
	gl.activeTexture(gl.TEXTURE5);	// shadow atlas savsm texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.shadow_atlas.savsm_active);
	gl.uniform1i(shader.uniforms.shadow_atlas_savsm_tex, 5);
	gl.activeTexture(gl.TEXTURE6);	// shadow atlas texture (shadow sampler)
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.shadow_atlas.depth_tex);
	gl.uniform1i(shader.uniforms.shadow_atlas_tex, 6);
	gl.activeTexture(gl.TEXTURE7);	// blue noise texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.img.blue_noise);
	gl.uniform1i(shader.uniforms.blue_noise_tex, 7);
	gl.activeTexture(gl.TEXTURE8);	// blue noise 1D texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.img.blue_noise_1d);
	gl.uniform1i(shader.uniforms.blue_noise_tex_1d, 8);

	// global uniform set
	// ------------------
	gl.uniform3fv(shader.uniforms.time, t3);

	// camera constants
	const view_m:mat4 = pd.cam.get_view_matrix();
	const inv_view_m:mat4 = M.mat4.create();
	M.mat4.invert(inv_view_m, view_m);
	// gl.uniformMatrix4fv(shader.uniforms.camera_view_to_world, false, inv_view_m);

	// light iteration
	// ---------------
	for(let light_index=0; light_index<room.spotlights.length; light_index++) {
		const light = room.spotlights[light_index];
		// shadowmap uniform set
		gl.uniform3f(shader.uniforms.shadow_atlas_info,  
			light_index % pd.tx.shadow_atlas.atlas_size,
			Math.floor(light_index / pd.tx.shadow_atlas.atlas_size),
			pd.tx.shadow_atlas.atlas_size);
		gl.uniform2fv(shader.uniforms.shadowmap_dims, pd.tx.shadow_atlas.map_dims);

		// matrix uniform set
		const c_view_to_l_view:mat4 = M.mat4.create();
		M.mat4.mul(c_view_to_l_view, light.cam.get_view_matrix(), inv_view_m);
		gl.uniformMatrix4fv(shader.uniforms.camera_view_to_light_view, false, c_view_to_l_view);
		gl.uniformMatrix4fv(shader.uniforms.light_proj, false, light.proj_m);

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
		gl.uniform1f(shader.uniforms.light_size, light.size);
		gl.uniform1f(shader.uniforms.light_min_bias, light.bias_range[0]);
		gl.uniform1f(shader.uniforms.light_max_bias, light.bias_range[1]);
		gl.uniform1f(shader.uniforms.light_znear, light.zplanes[0]);
		gl.uniform1f(shader.uniforms.light_zfar, light.zplanes[1]);

		// bind vao
		gl.bindVertexArray(pd.vaos.quad);
		// draw
		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
		// unbind vao
		gl.bindVertexArray(null);
	}

	// disable blending
	gl.disable(gl.BLEND);
}

/* QUAD DRAWN GBUFFER COMBINE PASS
================================== */
function quad_deferred_combine(gl:any, pd:any, write_to_frame:boolean, t3:vec3):void {
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
	gl.uniform3fv(shader.uniforms.time, t3);

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
	gl.activeTexture(gl.TEXTURE6);	// blue noise texture
	gl.bindTexture(gl.TEXTURE_2D, pd.tx.img.blue_noise);
	gl.uniform1i(shader.uniforms.blue_noise_tex, 6);

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
function render(gl:any, pd:any, t:number):void {
	// time adjustments
	const t_coeff = 1.0;//0.0005;
	t *= t_coeff;
	const t3:vec3 = [t,Math.cos(t),Math.sin(t)];

	// shadowmap pass
	shadowmap_pass(gl, pd, pd.room_list[0]);

	// summedarea pass
	summedarea_pass(gl, pd, pd.room_list[0]);

	// get projection matrix
	const proj_m:mat4 = get_projection(gl, 90);
	
	// draw scene to gbuffer
	gbuffer_pass(gl, pd, proj_m);

	// ssao passes
	if(pd.settings.ssao.enabled) {
		// ssao pass
		ssao_pass(gl, pd, proj_m);
		// ssao pass
		ssao_blur(gl, pd, t3);
	}

	// spotlight pass
	spotlight_pass(gl, pd, pd.room_list[0], t3);

	// combine gbuffer contents on quad
	quad_deferred_combine(gl, pd, !pd.settings.fxaa.enabled, t3);

	// fxaa post-process
	if(pd.settings.fxaa.enabled)
		fxaa_pass(gl, pd);

}

// EXPORTS
// ==============
export { render };