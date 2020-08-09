import { pretty_float } from '../ts/utils.ts';
import { SHADOWMAP_SIZE } from '../ts/texture_manager.ts';

// LOCATIONS
export const evsm_prefilter_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		sm_tex: 'u_sm_tex',
	}
}

// VERTEX SHADER
export const evsm_prefilter_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
 	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export function gen_evsm_prefilter_f(kernel, x_pass) {
	const dim = x_pass ? 'x' : 'y';
	const pf_length = 10;

	let offsets = [0.0]
	for(let i=1; i<kernel.length; i++)
		offsets.push(i);

	let kernel_loop = '';
	for(let i=1; i<kernel.length; i++) {
		kernel_loop += `
		offset.${dim} = ${pretty_float(offsets[i],pf_length)};
		o_fragcolor += texture(u_sm_tex, v_texcoord+offset)*${pretty_float(kernel[i],pf_length)};
		o_fragcolor += texture(u_sm_tex, v_texcoord-offset)*${pretty_float(kernel[i],pf_length)};`
	}

	return `#version 300 es
precision mediump float;

uniform sampler2D u_sm_tex;

in vec2 v_texcoord;

const float sm_res = ${pretty_float(1/SHADOWMAP_SIZE,pf_length)};

out vec4 o_fragcolor;

void main() {
	vec2 offest = vec2(0.0);
	o_fragcolor = texture(u_sm_tex, v_texcoord)*${pretty_float(kernel[0],pf_length)};
	${kernel_loop}
}
`;}

