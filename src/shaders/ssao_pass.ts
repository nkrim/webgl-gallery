import * as M from 'gl-matrix';
import { pretty_float, lerp } from '../ts/utils';
import { TextureManager } from '../ts/texture_manager';

// TUNING CONSTANTS
export const SSAO_KERNEL_SIZE:		number = 32;
export const SSAO_SAMPLE_RADIUS: 	number = 0.25;

// LOCATIONS
export const ssao_pass_l:any = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		pos_tex: 'u_pos_tex',
		norm_tex: 'u_norm_tex',
		noise_tex: 'u_noise_tex',
		samples_a: 'u_samples',
		proj_m: 'u_proj',
	}
}

// VERTEX SHADER
export const ssao_pass_v:string = `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER (generator)
export function gen_ssao_pass_f(viewport_width:number, viewport_height:number):string {
	return `#version 300 es
precision mediump float;

// noise sampling constants
const float viewport_width = ${pretty_float(viewport_width,1)};
const float viewport_height = ${pretty_float(viewport_height,1)};
const float noise_tex_dimension = 4.0;
const vec2 noise_scale = vec2(viewport_width/noise_tex_dimension, viewport_height/noise_tex_dimension);

// ssao kernel variables
const int kernel_size = ${SSAO_KERNEL_SIZE};
const float sample_radius = ${pretty_float(SSAO_SAMPLE_RADIUS,4)};
const float sample_depth_bias = 0.01;

// varyings
in vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_noise_tex;

// other uniforms
uniform vec3 u_samples[${SSAO_KERNEL_SIZE}];
uniform mat4 u_proj;

// out
out vec4 o_fragcolor;

void main() {
	// sample data of current fragment from textures
	vec3 pos = texture(u_pos_tex, v_texcoord).xyz; 
	vec3 norm = texture(u_norm_tex, v_texcoord).xyz; 
	vec3 rand = texture(u_noise_tex, noise_scale*v_texcoord).xyz;
	
	// construct tbn using randomized vector from noise as a means of acquiring a random tangent
	vec3 tangent = normalize(rand - norm * dot(rand, norm));
	vec3 bitangent = cross(norm, tangent);
	mat3 tbn = mat3(tangent, bitangent, norm);

	// calculate total occlusion from samples
	float occlusion = 0.0;
	for(int i=0; i<kernel_size; i++) {
		// transform sample to view-space
		vec3 view_sample = tbn * u_samples[i];
		view_sample = pos + view_sample*sample_radius;

		// get pixel in screen space from view-space coordinate
		vec4 ss_sample = vec4(view_sample, 1.0);
		ss_sample = u_proj * ss_sample;
		ss_sample.xyz /= ss_sample.w;
		// get texel from pixel
		ss_sample.xyz = ss_sample.xyz*0.5 + 0.5;

		// sample real depth of pixel from position gbuffer
		float sample_depth = texture(u_pos_tex, ss_sample.xy).z;

		// compare depth with offset-sample expected depth, add result to occlusion
		float range_bias = smoothstep(0.0, 1.0, sample_radius / abs(pos.z - sample_depth));
		occlusion += (sample_depth >= view_sample.z + sample_depth_bias ? 1.0 : 0.0) * range_bias;  
	}

	occlusion = 1.0 - occlusion/float(kernel_size);
  	o_fragcolor = vec4(vec3(occlusion), 1.0);
}

`};

export function gen_ssao_kernel(gl:any) {
	// init vector for operations
	const v = M.vec3.create();

	// generate sample kernel
	const sample_count = SSAO_KERNEL_SIZE;
	const samples:Array<number> = [];
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
	return new Float32Array(samples);
}
export function gen_ssao_noise(gl:any, tx:TextureManager):WebGLTexture {
	// init vector for operations
	const v = M.vec3.create();
	
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

	const tex = tx.gen_texture(gl, {
		filter_function: gl.NEAREST,
		texture_wrap: gl.REPEAT,
		internal_format: gl.RGB16F,
		dimensions:[tex_dimension,tex_dimension],
		src_format: gl.RGB,
		pixel: rotation_data,
	});

	// return sample kernel
	return tex;
}