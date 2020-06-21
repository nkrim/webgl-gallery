// TUNING CONSTANTS
export const SSAO_KERNEL_SIZE = 32;
export const SSAO_SAMPLE_RADIUS = 0.25;

// LOCATIONS
export const ssao_pass_l = {
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
export const ssao_pass_v = `
#version 100

attribute vec3 a_vert;

varying vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER (generator)
export function gen_ssao_pass_f(viewport_width, viewport_height) {return `
precision highp float;

// noise sampling constants
const float viewport_width = ${viewport_width}.0;
const float viewport_height = ${viewport_height}.0;
const float noise_tex_dimension = 4.0;
const vec2 noise_scale = vec2(viewport_width/noise_tex_dimension, viewport_height/noise_tex_dimension);

// ssao kernel variables
const int kernel_size = ${SSAO_KERNEL_SIZE};
const float sample_radius = ${SSAO_SAMPLE_RADIUS};
const float sample_depth_bias = 0.025;

// varyings
varying vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_noise_tex;

// other uniforms
uniform vec3 u_samples[${SSAO_KERNEL_SIZE}];
uniform mat4 u_proj;


void main() {
	// sample data of current fragment from textures
	vec3 pos = texture2D(u_pos_tex, v_texcoord).xyz; 
	vec3 norm = texture2D(u_norm_tex, v_texcoord).xyz; 
	vec3 rand = texture2D(u_noise_tex, noise_scale*v_texcoord).xyz;
	
	// construct tbn using randomized vector from noise as a means of acquiring a random tangent
	vec3 tangent = normalize(rand - norm * dot(rand, norm));
	vec3 bitangent = cross(norm, tangent);
	mat3 tbn = mat3(tangent, bitangent, norm);

	// calculate total occlusion from samples
	float occlusion = 0.0;
	for(int i=0; i<kernel_size; i++) {
		// transform sample to view-space
		vec3 sample = tbn * u_samples[i];
		sample = pos + sample*sample_radius;

		// get pixel in screen space from view-space coordinate
		vec4 ss_sample = vec4(sample, 1.0);
		ss_sample = u_proj * ss_sample;
		ss_sample.xyz /= ss_sample.w;
		// get texel from pixel
		ss_sample.xyz = ss_sample.xyz*0.5 + 0.5;

		// sample real depth of pixel from position gbuffer
		float sample_depth = texture2D(u_pos_tex, ss_sample.xy).z;

		// compare depth with offset-sample expected depth, add result to occlusion
		float range_bias = smoothstep(0.0, 1.0, sample_radius / abs(pos.z - sample_depth));
		occlusion += (sample_depth >= sample.z ? 1.0 : 0.0) * range_bias;  
	}

	occlusion = 1.0 - occlusion/float(kernel_size);
  	gl_FragColor = vec4(vec3(occlusion), 1.0);
}

`};