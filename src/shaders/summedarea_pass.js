// LOCATIONS
export const summedarea_pass_l = {
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

// \/ \/ \/ THIS VERSION SHOULD BE MORE OPTIMAL, BUT TEST W LATTER VERSION

// VERTEX SHADER
export function gen_summedarea_pass_v(x_pass) { 
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
export function gen_summedarea_pass_f(x_pass, first_pass=false) { 
	const dim = x_pass ? 'x' : 'y';
	return `#version 300 es
precision mediump float;

// varyings
in vec2 v_texcoord;
in vec2 v_add_texcoord;
in vec2 v_min_texcoord;

uniform sampler2D u_in_tex;

out vec4 o_fragcolor;

void main() {
	o_fragcolor = vec4(texture(u_in_tex, v_texcoord).xyz${first_pass ? '-vec3(0.5)':''}, 1.0);
	if(v_texcoord.${dim} < v_min_texcoord.${dim}) 
		return;
	o_fragcolor.xyz += texture(u_in_tex, v_add_texcoord).xyz${first_pass ? '-vec3(0.5)':''};
}
`;}

/*// VERTEX SHADER
export function gen_summedarea_pass_v(x_pass) { 
	const dim = x_pass ? 'x' : 'y';
	return `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	// get v_texcoord
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
    // output vertex
	gl_Position = vec4(a_vert, 1.0);
}
`};

// FRAGMENT SHADER
export function gen_summedarea_pass_f(x_pass) { 
	const dim = x_pass ? 'x' : 'y';
	return `#version 300 es
precision mediump float;

// varyings
in vec2 v_texcoord;

uniform int u_iter;

uniform sampler2D u_in_tex;
uniform vec3 u_atlas_info;
uniform vec2 u_tex_dims;

out vec4 o_fragcolor;

void main() {
	vec2 cur_texcoord = v_texcoord + u_atlas_info.xy;
	vec2 texel_size = 1.0/(u_tex_dims*u_atlas_info.z);
	float offset = float(1<<u_iter)*texel_size.${dim};

	vec2 add_texcoord = v_texcoord;
	add_texcoord.${dim} -= offset;

	vec2 min_texcoord = u_atlas_info.xy;
	min_texcoord.${dim} += offset;

	cur_texcoord /= u_atlas_info.z;
	add_texcoord /= u_atlas_info.z;
	min_texcoord /= u_atlas_info.z;

	o_fragcolor = vec4(texture(u_in_tex, cur_texcoord).xyz, 1.0);
	if(cur_texcoord.${dim} < min_texcoord.${dim}) 
		return;
	o_fragcolor.xyz += texture(u_in_tex, add_texcoord).xyz;
}
`;}*/



