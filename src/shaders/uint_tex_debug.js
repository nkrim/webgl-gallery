import { pretty_float } from '../ts/utils.ts';

// LOCATIONS
export const uint_tex_debug_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		in_tex: 'u_in_tex',
	}
}

// VERTEX SHADER
export const uint_tex_debug_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	// get v_texcoord
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);

    // output vertex
	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export const uint_tex_debug_f = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

// varyings
in vec2 v_texcoord;

uniform usampler2D u_in_tex;

const float scale = 0.01;

out vec4 o_fragcolor;

void main() {
	uvec4 c = texture(u_in_tex, v_texcoord);
	o_fragcolor = vec4(vec3(c.xyz)/float(c.w)*scale, 1.0);
}
`;