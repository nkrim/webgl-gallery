// LOCATIONS
export const evsm_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		sm_tex: 'u_sm_tex',
		exponents: 'u_exponents',
	}
}

// VERTEX SHADER
export const evsm_pass_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
 	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export const evsm_pass_f = `#version 300 es
precision mediump float;

uniform sampler2D u_sm_tex;
uniform vec2 u_exponents;

const float bias = 0.0005;

in vec2 v_texcoord;

out vec4 o_fragcolor;

void main() {
	float lin_z = texture(u_sm_tex, v_texcoord).x + bias;
	lin_z = lin_z*2.0 - 1.0;
	float p_exp_z = exp(u_exponents.x * lin_z);
	float n_exp_z = -exp(-u_exponents.y * lin_z);
	o_fragcolor = vec4(p_exp_z, p_exp_z*p_exp_z, n_exp_z, n_exp_z*n_exp_z);
	// o_fragcolor = vec4(p_exp_z, p_exp_z*p_exp_z, 0.0,1.0);
	// o_fragcolor = vec4(lin_z, 0.0, 0.0, 1.0); 
	// o_fragcolor = vec4(lin_z,0.0,0.0,1.0); 
	// o_fragcolor = vec4(z, 0.0, 0.0, 1.0);
}
`

