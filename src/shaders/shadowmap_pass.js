// LOCATIONS
export const shadowmap_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		proj_m: 'u_proj',
		mv_m: 'u_mv',
	}
}

// VERTEX SHADER
export const shadowmap_pass_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

uniform mat4 u_mv;
uniform mat4 u_proj;

void main() {
 	gl_Position = u_proj * u_mv * vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export const shadowmap_pass_f = `#version 300 es
precision mediump float;

out vec4 o_fragcolor;

void main() { 
	o_fragcolor = vec4(1.0,1.0,1.0,1.0); 
}
`

