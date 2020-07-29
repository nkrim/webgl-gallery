import { pretty_float } from '../ts/utils.ts';

// LOCATIONS
export const summedarea_uint_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		iter: 'u_iter',
		in_tex: 'u_in_tex',
		tex_dims: 'u_tex_dims',
		atlas_info: 'u_atlas_info',
	}
}

// VERTEX SHADER
export function gen_summedarea_uint_pass_v(x_pass) { 
	const dim = x_pass ? 'x' : 'y';
	return `#version 300 es

layout(location = 0) in vec3 a_vert;

uniform int u_iter;

uniform vec3 u_atlas_info;
uniform vec2 u_tex_dims;

out vec2 v_texcoord;
out vec2 v_add_texcoord;
out vec2 v_min_texcoord;

void main() {
	// get v_texcoord
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	v_texcoord += u_atlas_info.xy;
    // get v_add_texcoord
    v_add_texcoord = v_texcoord;
    v_add_texcoord.${dim} -= float(1<<u_iter)/u_tex_dims.${dim};
    // get v_min_texcoord
    v_min_texcoord = u_atlas_info.xy;
    v_min_texcoord.${dim} += float(1<<u_iter)/u_tex_dims.${dim};
    // normalize to atlas
    v_texcoord /= u_atlas_info.z;
    v_add_texcoord /= u_atlas_info.z;
    v_min_texcoord /= u_atlas_info.z;

    // output vertex
	gl_Position = vec4(a_vert, 1.0);
}
`};

// FRAGMENT SHADER
export function gen_summedarea_uint_pass_f(tex_dims, x_pass, first_pass=false) { 
	const dim = x_pass ? 'x' : 'y';
	return `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

// varyings
in vec2 v_texcoord;
in vec2 v_add_texcoord;
in vec2 v_min_texcoord;

uniform ${first_pass ? 'sampler2D' : 'usampler2D'} u_in_tex;

const float max_value = 4096.0;//${pretty_float(4294967296/(tex_dims[0]*tex_dims[1]), 6)};

out uvec4 o_fragcolor;

void main() {
	o_fragcolor = ${first_pass
		?'uvec4(uvec3(max_value*texture(u_in_tex, v_texcoord).xyz),uint(max_value))'
		:'texture(u_in_tex, v_texcoord)'};
	if(v_texcoord.${dim} < v_min_texcoord.${dim}) 
		return;
	o_fragcolor.xyz += ${first_pass
		?'uvec3(max_value*texture(u_in_tex, v_add_texcoord).xyz)'
		:'texture(u_in_tex, v_add_texcoord).xyz'};
}
`;}